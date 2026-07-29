import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

/**
 * Threat Intelligence slice — reads the aggregated indicator feed from
 * /api/admin/threat-intelligence/* (AdminThreatIntelligenceController).
 *
 * Threat Intelligence is NOT a scanner. The server projects data the platform
 * already holds — fake domains, abusive IPs and analyst-curated manual
 * indicators — into one canonical indicator shape. Nothing is persisted, so
 * there is no create/update/delete here.
 *
 * SEARCH-FIRST BY DESIGN
 * ----------------------
 * The page opens empty and stays empty until an operator picks a company.
 * `company_id` is required on every indicator call, so no cross-tenant
 * preload is even possible from this surface.
 *
 * Manual indicators are CREATED in the existing
 *   Admin → Module data → Brand Protection → Social / Manual Indicators
 * screen. This slice deliberately has no write path so manual data keeps
 * exactly one place it can be entered or edited.
 *
 * Capability gate: threat_intel.read (owner / security / support / viewer).
 */

const CFG = { showSuccessToast: false, showErrorToast: false };

// Re-scan plumbing. Fake domains and abusive IPs are both produced by the
// brand_protection module, so one run refreshes both machine sources.
const RESCAN_MODULE     = 'brand_protection';
const POLL_INTERVAL_MS  = 2500;
const POLL_MAX_MS       = 8 * 60 * 1000;
const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Monotonic counter for typeahead responses (see searchThreatIntelCompanies).
let searchSeq = 0;
const errOf = (e) => e?.response?.data?.message || e?.message || 'Threat Intelligence request failed';

/** Company typeahead. Empty search returns nothing by contract. */
export const searchThreatIntelCompanies = createAsyncThunk(
    'threatIntel/searchCompanies',
    async (search, { rejectWithValue }) => {
        try {
            const term = String(search ?? '').trim();
            if (!term) return { term, results: [], seq: ++searchSeq };

            // Monotonic sequence stamped BEFORE the await. Responses can land
            // out of order (a slow "red" resolving after a fast "redseclabs"),
            // which previously repainted the dropdown with stale results; the
            // reducer drops anything older than what it already holds.
            const seq = ++searchSeq;

            const res = await apiRequest.get('/admin/threat-intelligence/companies', {
                ...CFG,
                params: { search: term, limit: 10 },
            });

            return { term, results: res.data?.data ?? [], seq };
        } catch (e) { return rejectWithValue(errOf(e)); }
    },
);

/**
 * The feed for one company.
 *
 * Filters are passed straight through as query params; empty values are
 * stripped so the backend's `nullable` rules see them as absent rather than
 * as a literal empty string.
 */
export const fetchThreatIndicators = createAsyncThunk(
    'threatIntel/fetchIndicators',
    async ({ companyId = null, filters = {}, page = 1, refresh = false }, { rejectWithValue }) => {
        try {
            // No companyId => the default cross-company listing. The backend
            // treats company_id as optional and caps the unscoped feed.
            const params = { page };
            if (companyId) params.company_id = companyId;
            Object.entries(filters).forEach(([k, v]) => {
                if (v !== '' && v != null) params[k] = v;
            });
            if (refresh) params.refresh = 1;

            const res = await apiRequest.get('/admin/threat-intelligence/indicators', { ...CFG, params });
            return { data: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    },
);

/**
 * Re-scan the underlying sources, then rebuild the feed.
 *
 * The team's preference is to obtain fake domains / abusive IPs from the
 * upstream APIs rather than only from previously-saved scan output. That path
 * already exists and is reused verbatim rather than rebuilt:
 *
 *   POST /admin/orchestrator/run { module_name: 'brand_protection' }
 *
 * AdminOrchestratorController flags the run `force`, so every read-through
 * cache is bypassed and the same BrandProtectionService the customer pipeline
 * calls hits upstream and re-persists. One scan path, one source of truth.
 *
 * The run is ASYNC (202 + a ScanJob) so it is never bound by the HTTP /
 * Cloudflare ~100s ceiling; we poll the job to a terminal state exactly as
 * adminAssessmentSlice does, then refresh the feed.
 *
 * Requires the `scans.run` capability — the page gates the control so roles
 * that only hold `threat_intel.read` keep the instant cache-only refresh.
 */
export const rescanThreatIntelSources = createAsyncThunk(
    'threatIntel/rescanSources',
    async ({ companyId, domainId }, { dispatch, rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/orchestrator/run', {
                company_id:  companyId,
                domain_id:   domainId,
                module_name: RESCAN_MODULE,
            }, CFG);

            let job = res.data ?? {};

            // Some modules short-circuit synchronously (post-connect /
            // not-enabled) and return no job_id — nothing to poll.
            if (job.job_id) {
                const startedAt = Date.now();
                while (!TERMINAL_STATUSES.includes(job.status)) {
                    if (Date.now() - startedAt > POLL_MAX_MS) {
                        return rejectWithValue('Timed out waiting for the re-scan to finish.');
                    }
                    await sleep(POLL_INTERVAL_MS);
                    const poll = await apiRequest.get(`/admin/orchestrator/job/${job.job_id}`, CFG);
                    job = poll.data ?? job;
                }

                if (job.status !== 'completed') {
                    return rejectWithValue(job.error || 'Re-scan did not complete.');
                }
            }

            // Rebuild the feed from the rows the scan just persisted.
            await dispatch(fetchThreatIndicators({ companyId, refresh: true }));

            return { status: job.status ?? 'completed' };
        } catch (e) { return rejectWithValue(errOf(e)); }
    },
);

/**
 * Permanently delete an indicator from its underlying source.
 *
 * Indicators are projections, so the server resolves the reference back to the
 * source that owns it: a JSON entry on a scan row for fake domains / abusive
 * IPs, a brand_social_indicators row (plus a company re-score) for manual
 * indicators. The UI does not need to know which.
 *
 * `company_id` comes from the indicator itself, so this works identically on
 * the cross-company default listing and on a searched company.
 *
 * On success the current page is refetched with the SAME filters, search and
 * page, so counts and breakdowns stay consistent without a full reload and
 * without losing the operator's place.
 *
 * Requires the `threat_intel.write` capability.
 */
export const deleteThreatIndicator = createAsyncThunk(
    'threatIntel/deleteIndicator',
    async ({ indicator }, { dispatch, getState, rejectWithValue }) => {
        const indicatorId = indicator?.indicator_id;
        const companyId   = indicator?.company_id;

        if (!indicatorId || !companyId) {
            return rejectWithValue('This indicator cannot be deleted: it is missing its company reference.');
        }

        try {
            await apiRequest.delete(`/admin/threat-intelligence/indicators/${indicatorId}`, {
                ...CFG,
                params: { company_id: companyId },
            });

            toast.success('Indicator deleted');

            // Rebuild the current view in place — same scope, same filters,
            // same page — so counts, breakdowns and pagination stay truthful.
            const st = getState().threatIntel;
            await dispatch(fetchThreatIndicators({
                companyId: st.company?.id ?? null,
                filters:   st.filters,
                page:      st.page,
                // NOT a forced refresh. The server already busted the affected
                // company's feed and the assembled cross-company listing when
                // it deleted the indicator, so a plain read returns fresh data.
                // Forcing here would rebuild EVERY company's feed from source
                // on every single delete.
                refresh:   false,
            }));

            return { indicatorId };
        } catch (e) {
            const msg = errOf(e);
            toast.error(msg);
            return rejectWithValue(msg);
        }
    },
);

/* ─── PTA MISP synchronization ─────────────────────────────────────────
 * Pushes the current company's Threat Intelligence indicators to PTA's MISP
 * instance. Queued server-side (SyncIndicatorsToMispJob); these thunks just
 * trigger and poll status. Gated on the misp.sync capability (owner).
 * ------------------------------------------------------------------------ */

export const fetchMispStatus = createAsyncThunk(
    'threatIntel/mispStatus',
    async (companyId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/misp/status', {
                ...CFG, params: { company_id: companyId },
            });
            return res.data?.data ?? null;
        } catch (e) { return rejectWithValue(errOf(e)); }
    },
);

export const syncCompanyToMisp = createAsyncThunk(
    'threatIntel/mispSync',
    async ({ companyId, retry = false }, { dispatch, rejectWithValue }) => {
        try {
            const path = retry ? '/admin/misp/retry' : '/admin/misp/sync';
            await apiRequest.post(path, { company_id: companyId }, CFG);
            toast.success(retry ? 'MISP retry queued' : 'MISP sync queued');
            // The job runs async; poll status shortly after so counts move.
            setTimeout(() => dispatch(fetchMispStatus(companyId)), 1500);
            return true;
        } catch (e) {
            const msg = errOf(e);
            toast.error(msg);
            return rejectWithValue(msg);
        }
    },
);

const initialState = {
    // Company search
    companyResults:  [],
    searching:       false,
    lastSearchSeq:   0,
    company:         null,   // the selected company — null means "nothing searched yet"

    // Feed
    list:            [],
    meta:            null,
    loading:         false,
    error:           null,

    // UI
    filters:         { source_key: '', severity: '', status: '', indicator_type: '', q: '' },
    selected:        null,   // indicator object shown in the detail panel

    // Re-scan from source (orchestrator run + job polling)
    rescanning:      false,
    rescanError:     null,

    // Pagination (server-side; the cross-company feed can be large)
    page:            1,

    // Indicator pending confirmation, and the id currently being deleted
    pendingDelete:   null,
    deletingId:      null,

    // PTA MISP sync
    mispStatus:      null,
    mispSyncing:     false,
};

const slice = createSlice({
    name: 'threatIntel',
    initialState,
    reducers: {
        /** Operator picked a company from the typeahead. Clears the previous feed. */
        selectThreatIntelCompany(state, action) {
            state.company        = action.payload ?? null;
            state.companyResults = [];
            state.list           = [];
            state.meta           = null;
            state.error          = null;
            state.selected       = null;
            state.filters        = { ...initialState.filters };
            state.rescanError    = null;
            state.page           = 1;
        },
        setThreatIntelFilter(state, action) {
            const { key, value } = action.payload;
            state.filters[key] = value;
            // Any filter change invalidates the current page offset.
            state.page = 1;
        },
        setThreatIntelPage(state, action) {
            state.page = Math.max(1, Number(action.payload) || 1);
        },
        askDeleteThreatIndicator(state, action) {
            state.pendingDelete = action.payload ?? null;
        },
        cancelDeleteThreatIndicator(state) {
            state.pendingDelete = null;
        },
        clearThreatIntelFilters(state) {
            state.filters = { ...initialState.filters };
            state.page    = 1;
        },
        openThreatIndicator(state, action) {
            state.selected = action.payload ?? null;
        },
        closeThreatIndicator(state) {
            state.selected = null;
        },
        /** Back to the empty search-first state. */
        resetThreatIntel() {
            return { ...initialState };
        },
    },
    extraReducers: (b) => {
        b
            .addCase(searchThreatIntelCompanies.pending,   (s) => { s.searching = true; s.error = null; })
            .addCase(searchThreatIntelCompanies.fulfilled, (s, a) => {
                s.searching = false;
                // Ignore a stale response that lost the race.
                if ((a.payload?.seq ?? 0) < s.lastSearchSeq) return;
                s.lastSearchSeq  = a.payload?.seq ?? s.lastSearchSeq;
                s.companyResults = a.payload?.results ?? [];
            })
            .addCase(searchThreatIntelCompanies.rejected,  (s, a) => { s.searching = false; s.error = a.payload; })

            .addCase(fetchThreatIndicators.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(fetchThreatIndicators.fulfilled, (s, a) => {
                s.loading = false;
                s.list    = a.payload.data;
                s.meta    = a.payload.meta;
            })
            .addCase(fetchThreatIndicators.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            .addCase(rescanThreatIntelSources.pending,   (s) => { s.rescanning = true;  s.rescanError = null; })
            .addCase(rescanThreatIntelSources.fulfilled, (s) => { s.rescanning = false; })
            .addCase(rescanThreatIntelSources.rejected,  (s, a) => { s.rescanning = false; s.rescanError = a.payload; })

            .addCase(deleteThreatIndicator.pending,   (s, a) => {
                s.deletingId    = a.meta.arg?.indicator?.indicator_id ?? null;
                s.pendingDelete = null;
            })
            .addCase(deleteThreatIndicator.fulfilled, (s) => {
                s.deletingId = null;
                // If the open detail panel was the deleted row, close it
                // so nothing stale remains on screen.
                s.selected   = null;
            })
            .addCase(deleteThreatIndicator.rejected,  (s, a) => { s.deletingId = null; s.error = a.payload; })

            .addCase(fetchMispStatus.fulfilled, (s, a) => { s.mispStatus = a.payload; })
            .addCase(syncCompanyToMisp.pending,   (s) => { s.mispSyncing = true; })
            .addCase(syncCompanyToMisp.fulfilled, (s) => { s.mispSyncing = false; })
            .addCase(syncCompanyToMisp.rejected,  (s) => { s.mispSyncing = false; });
    },
});

export const {
    selectThreatIntelCompany,
    setThreatIntelFilter,
    setThreatIntelPage,
    askDeleteThreatIndicator,
    cancelDeleteThreatIndicator,
    clearThreatIntelFilters,
    openThreatIndicator,
    closeThreatIndicator,
    resetThreatIntel,
} = slice.actions;

export const selectTiCompany        = (st) => st.threatIntel.company;
export const selectTiCompanyResults = (st) => st.threatIntel.companyResults;
export const selectTiSearching      = (st) => st.threatIntel.searching;
export const selectTiIndicators     = (st) => st.threatIntel.list;
export const selectTiMeta           = (st) => st.threatIntel.meta;
export const selectTiLoading        = (st) => st.threatIntel.loading;
export const selectTiError          = (st) => st.threatIntel.error;
export const selectTiFilters        = (st) => st.threatIntel.filters;
export const selectTiSelected       = (st) => st.threatIntel.selected;
export const selectTiRescanning     = (st) => st.threatIntel.rescanning;
export const selectTiRescanError    = (st) => st.threatIntel.rescanError;
export const selectTiPage           = (st) => st.threatIntel.page;
export const selectTiPendingDelete  = (st) => st.threatIntel.pendingDelete;
export const selectTiDeletingId     = (st) => st.threatIntel.deletingId;
export const selectTiMispStatus     = (st) => st.threatIntel.mispStatus;
export const selectTiMispSyncing    = (st) => st.threatIntel.mispSyncing;

export default slice.reducer;
