import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

/**
 * adminAssessmentSlice — admin-driven scan runner.
 *
 * Mirrors the customer-side assessmentSlice pattern EXACTLY: for each
 * (domain × module) tuple, the frontend issues an independent
 * POST /admin/orchestrator/run call. The backend route is a thin admin-
 * authed wrapper around ModuleOrchestratorService — the SAME entry the
 * customer Assessment page hits — so post-run DB state is byte
 * identical (same scans rows, same per-module persistence, same
 * DomainScored event, same company-risk recompute).
 *
 * Why NOT /admin/orchestrator/run-multi any more?
 *   That endpoint runs all six modules synchronously in one HTTP
 *   request. The full bulk path took ~184s in /laravel.log (16:42:41
 *   → 16:45:45) while the admin axios client has a 30s default
 *   timeout, so the XHR was cancelled at 30s and the UI showed
 *   "Has failures" even though every module had completed and
 *   persisted successfully on the backend. Splitting per-module
 *   keeps each request's wall-clock under a tolerable bound (worst
 *   single module observed: 60.63s for application_security) and
 *   surfaces live per-module progress as each response returns.
 *
 * The 30s global timeout is preserved for every other admin call;
 * orchestrator runs explicitly opt in to a 5-min per-call timeout
 * (sufficient for any single module — see /laravel.log per-module
 * elapsed_secs entries).
 *
 * Two run modes:
 *   - runAdminAssessment({ companyId, domainId, modules? })
 *       Single domain, all modules (or a subset). Sequential loop
 *       over modules; after success, stamps domains.scanned_at via
 *       PATCH /admin/domains/{domain}/scanned — same mark-scanned
 *       semantics as the customer client.
 *   - runAdminBulkAssessment({ companyId, domainIds, modules? })
 *       Outer loop over domains, inner loop is the per-module
 *       sequence above. No single HTTP request scans more than one
 *       module.
 */

const API_CONFIG = { showSuccessToast: false, showErrorToast: false };

// Per-call timeout override for orchestrator runs. The global admin
// axios timeout is 30s (api/client.js); single modules can take ~60s
// on cold paths. 5 min is generous enough for any observed module
// while still detecting a genuinely hung backend.
const ORCHESTRATOR_TIMEOUT_MS = 5 * 60 * 1000;

const errorOf = (e) => e?.response?.data?.message || e?.message || 'Assessment failed';

// ── Module set (mirrors ModuleOrchestratorService::ASSESSMENT_MODULES) ──
export const ADMIN_ASSESSMENT_MODULES = [
    { name: 'brand_protection',     label: 'Brand Protection' },
    { name: 'domain_security',      label: 'Domain Security' },
    { name: 'application_security', label: 'Application Security' },
    { name: 'network_security',     label: 'Network Security' },
    { name: 'compliance',           label: 'Compliance' },
    { name: 'scoring_engine',       label: 'Scoring Engine' },
];

// scoring_engine MUST run last — mirrors the customer flow. It reads
// the rows the upstream modules just persisted, then writes
// DomainScoringResult, which triggers RecomputeCompanyRiskOnDomainScored.
function orderForRun(modules) {
    const list = [...modules];
    const idx  = list.findIndex((m) => m === 'scoring_engine');
    if (idx !== -1) {
        list.splice(idx, 1);
        list.push('scoring_engine');
    }
    return list;
}

// ── Thunks ────────────────────────────────────────────────────────────────

/**
 * Run a single module on a single domain. Used both for retries from
 * the UI's retry pill and as the inner step of runAdminAssessment.
 * Carries the 5-min per-call timeout — orchestrator runs are the
 * one admin path that legitimately exceeds the 30s default.
 */
export const runAdminModule = createAsyncThunk(
    'adminAssessment/runModule',
    async ({ companyId, domainId, moduleName }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/orchestrator/run', {
                company_id:  companyId,
                domain_id:   domainId,
                module_name: moduleName,
            }, { ...API_CONFIG, timeout: ORCHESTRATOR_TIMEOUT_MS });
            return { domainId, moduleName, response: res.data };
        } catch (e) {
            return rejectWithValue({ domainId, moduleName, error: errorOf(e) });
        }
    },
);

/**
 * Full single-domain assessment. Loops modules sequentially calling
 * /admin/orchestrator/run for each so no single request can exceed
 * its (5-min) per-call timeout. Per-module status flips live as each
 * response returns; the UI re-renders each chip immediately.
 *
 * "Has failures" only when the backend response itself reports
 * success:false for a module — never because axios cancelled the
 * request (the per-call timeout exists exactly to prevent that
 * conflating-cancellation-with-failure case observed before this
 * refactor).
 */
export const runAdminAssessment = createAsyncThunk(
    'adminAssessment/runAssessment',
    async ({ companyId, domainId, modules }, { dispatch }) => {
        const moduleNames = orderForRun(
            (modules && modules.length > 0)
                ? modules
                : ADMIN_ASSESSMENT_MODULES.map((m) => m.name)
        );

        dispatch(adminAssessmentSlice.actions.startDomain({ domainId }));

        // Build the per-module result map in the shape recordDomainResult
        // expects — same shape /admin/orchestrator/run-multi returned, so
        // downstream consumers (chips, retry button) don't need a second
        // code path.
        const moduleResults = {};
        let anyRealUpstream = false;
        let allOk           = true;

        for (const moduleName of moduleNames) {
            dispatch(adminAssessmentSlice.actions.markModuleRunning({
                domainId, moduleName,
            }));

            const action = await dispatch(runAdminModule({
                companyId, domainId, moduleName,
            }));

            if (runAdminModule.fulfilled.match(action)) {
                const r = action.payload?.response ?? {};
                const ok = !!r.success;
                allOk = allOk && ok;
                if (ok && r.degraded === false) anyRealUpstream = true;
                moduleResults[moduleName] = {
                    status:   ok ? 'success' : 'failed',
                    data:     r,
                    steps:    r.steps    ?? [],
                    summary:  r.summary  ?? null,
                    degraded: !!r.degraded,
                };
            } else {
                // Genuine failure (5xx, dropped connection, etc).
                // Per-call timeout is 5min so this cannot be an axios
                // cancellation under any observed module runtime.
                allOk = false;
                moduleResults[moduleName] = {
                    status: 'failed',
                    error:  { message: action.payload?.error ?? 'unknown' },
                    steps:  [],
                };
            }
        }

        dispatch(adminAssessmentSlice.actions.recordDomainResult({
            domainId,
            modules: moduleResults,
            success: allOk,
        }));

        // Stamp scanned_at — the customer flow does the same via
        // PATCH /api/domain/{id}/scanned in markDomainScanned. Only
        // stamp if we actually exercised real upstream work; an
        // all-mock run shouldn't pretend the domain was scanned.
        if (anyRealUpstream || allOk) {
            try {
                await apiRequest.patch(`/admin/domains/${domainId}/scanned`, {}, API_CONFIG);
            } catch (e) {
                console.warn(`mark-scanned failed for ${domainId}:`, errorOf(e));
            }
        }

        return { domainId, success: allOk, modules: moduleResults };
    },
);

/**
 * Bulk: sequentially run a full assessment on every domain in the
 * supplied list. Sequential (not parallel) for the same reason the
 * customer client is sequential — sharing an Azure cold-start window
 * across N domains was the failure mode that produced the cURL 28
 * timeouts addressed in a prior pass.
 */
export const runAdminBulkAssessment = createAsyncThunk(
    'adminAssessment/runBulkAssessment',
    async ({ companyId, domainIds, modules }, { dispatch }) => {
        dispatch(adminAssessmentSlice.actions.startBulk({ domainIds }));

        const summary = { ok: [], failed: [] };
        for (const domainId of domainIds) {
            const res = await dispatch(runAdminAssessment({ companyId, domainId, modules }));
            if (runAdminAssessment.fulfilled.match(res) && res.payload?.success) {
                summary.ok.push(domainId);
            } else {
                summary.failed.push(domainId);
            }
        }

        dispatch(adminAssessmentSlice.actions.finishBulk());

        if (summary.ok.length && !summary.failed.length) {
            toast.success(`Assessment complete on ${summary.ok.length} domain${summary.ok.length === 1 ? '' : 's'}`);
        } else if (summary.ok.length && summary.failed.length) {
            toast(`Assessment finished — ${summary.ok.length} ok, ${summary.failed.length} with failures`, { icon: '⚠️' });
        } else if (summary.failed.length) {
            toast.error(`All ${summary.failed.length} domain assessments had failures — open per-domain details`);
        }

        return summary;
    },
);

// ── Slice ─────────────────────────────────────────────────────────────────

const initialDomainProgress = () => ({
    status:   'pending',           // pending | running | success | failed
    modules:  ADMIN_ASSESSMENT_MODULES.reduce((m, x) => {
        m[x.name] = { status: 'pending', degraded: false };
        return m;
    }, {}),
    error:    null,
    finishedAt: null,
});

const adminAssessmentSlice = createSlice({
    name: 'adminAssessment',
    initialState: {
        // Per-domain progress, keyed by domainId. The UI reads from here
        // for the per-row status grid.
        progress: {},
        // Bulk-run book-keeping.
        bulk: { running: false, domainIds: [] },
    },
    reducers: {
        clearAdminAssessment: (s, a) => {
            const id = a.payload?.domainId;
            if (id) delete s.progress[id];
            else s.progress = {};
        },
        startDomain: (s, a) => {
            const { domainId } = a.payload;
            s.progress[domainId] = { ...initialDomainProgress(), status: 'running' };
        },
        markModuleRunning: (s, a) => {
            const { domainId, moduleName } = a.payload;
            const slot = s.progress[domainId] ?? initialDomainProgress();
            slot.modules[moduleName] = {
                ...(slot.modules[moduleName] ?? {}),
                status:   'running',
                degraded: false,
                error:    null,
            };
            slot.status = 'running';
            s.progress[domainId] = slot;
        },
        recordDomainResult: (s, a) => {
            const { domainId, modules, success } = a.payload;
            const slot = s.progress[domainId] ?? initialDomainProgress();
            for (const [name, info] of Object.entries(modules || {})) {
                const status = info?.status === 'success' ? 'success'
                            : info?.status === 'skipped_post_connect_only' ? 'skipped'
                            : 'failed';
                slot.modules[name] = {
                    status,
                    degraded: !!info?.degraded,
                    error:    info?.error?.message ?? null,
                };
            }
            slot.status     = success ? 'success' : 'failed';
            slot.finishedAt = new Date().toISOString();
            s.progress[domainId] = slot;
        },
        failDomain: (s, a) => {
            const { domainId, error } = a.payload;
            const slot = s.progress[domainId] ?? initialDomainProgress();
            slot.status = 'failed';
            slot.error  = error;
            slot.finishedAt = new Date().toISOString();
            s.progress[domainId] = slot;
        },
        startBulk: (s, a) => {
            s.bulk.running   = true;
            s.bulk.domainIds = a.payload.domainIds;
        },
        finishBulk: (s) => {
            s.bulk.running = false;
        },
    },
    extraReducers: (b) => {
        b.addCase(runAdminModule.fulfilled, (s, a) => {
            const { domainId, moduleName, response } = a.payload;
            const slot = s.progress[domainId] ?? initialDomainProgress();
            slot.modules[moduleName] = {
                status:   response?.success ? 'success' : 'failed',
                degraded: !!response?.degraded,
                error:    null,
            };
            s.progress[domainId] = slot;
        });
        b.addCase(runAdminModule.rejected, (s, a) => {
            const { domainId, moduleName, error } = a.payload ?? {};
            if (!domainId || !moduleName) return;
            const slot = s.progress[domainId] ?? initialDomainProgress();
            slot.modules[moduleName] = { status: 'failed', degraded: false, error };
            s.progress[domainId] = slot;
        });
    },
});

export const { clearAdminAssessment } = adminAssessmentSlice.actions;
export default adminAssessmentSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────
export const selectAdminAssessmentProgress = (s, domainId) =>
    s.adminAssessment.progress[domainId] ?? null;
export const selectAdminBulkRunning = (s) => s.adminAssessment.bulk.running;
export const selectAdminBulkDomainIds = (s) => s.adminAssessment.bulk.domainIds;
