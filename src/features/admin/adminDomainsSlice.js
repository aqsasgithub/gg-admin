import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

/**
 * Per-company domain management.
 *
 * Caches the domain list + license rollup per companyId so navigation
 * between companies doesn't trigger refetches. The bulk-import flow
 * preserves the per-row outcome so the UI can display "12 added, 3
 * skipped" with the reasons.
 */

const API_CONFIG = { showSuccessToast: false, showErrorToast: false };
const errorOf = (e) => e?.response?.data?.message || e?.message || 'Domain request failed';

// ── Thunks ────────────────────────────────────────────────────────────────

export const fetchCompanyDomains = createAsyncThunk(
    'adminDomains/fetchCompanyDomains',
    async ({ companyId, ...params }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/domains`, { ...API_CONFIG, params });
            return {
                companyId,
                list:    res.data?.data    ?? [],
                license: res.data?.license ?? null,
                meta:    res.data?.meta    ?? null,
            };
        } catch (e) { return rejectWithValue({ companyId, error: errorOf(e) }); }
    },
);

export const addCompanyDomain = createAsyncThunk(
    'adminDomains/addCompanyDomain',
    async ({ companyId, payload }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/companies/${companyId}/domains`, payload, API_CONFIG);
            toast.success(`Added ${payload.domain}`);
            return { companyId, domain: res.data?.data };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ companyId, error: errorOf(e) });
        }
    },
);

export const bulkAddDomains = createAsyncThunk(
    'adminDomains/bulkAddDomains',
    async ({ companyId, domains, in_scope = true }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/companies/${companyId}/domains/bulk`, {
                domains,
                in_scope,
            }, API_CONFIG);
            const r = res.data?.data;
            if (r?.created_count) {
                toast.success(`Added ${r.created_count} domain${r.created_count === 1 ? '' : 's'}` +
                              (r.skipped_count ? ` (${r.skipped_count} skipped)` : ''));
            } else if (r?.skipped_count) {
                toast.error(`All ${r.skipped_count} domains were skipped — see details.`);
            }
            return { companyId, result: r };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ companyId, error: errorOf(e) });
        }
    },
);

export const updateDomain = createAsyncThunk(
    'adminDomains/updateDomain',
    async ({ companyId, domainId, payload }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.put(`/admin/domains/${domainId}`, payload, API_CONFIG);
            toast.success('Domain updated');
            return { companyId, domain: res.data?.data };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ companyId, error: errorOf(e) });
        }
    },
);

export const toggleDomainScope = createAsyncThunk(
    'adminDomains/toggleDomainScope',
    async ({ companyId, domainId }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/domains/${domainId}/scope`, {}, API_CONFIG);
            return { companyId, domain: res.data?.data };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ companyId, error: errorOf(e) });
        }
    },
);

export const removeDomain = createAsyncThunk(
    'adminDomains/removeDomain',
    async ({ companyId, domainId }, { rejectWithValue }) => {
        try {
            await apiRequest.delete(`/admin/domains/${domainId}`, API_CONFIG);
            toast.success('Domain removed');
            return { companyId, domainId };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ companyId, error: errorOf(e) });
        }
    },
);

// ── Network Security target IPs ─────────────────────────────────────────
// Admin acts on behalf of the tenant. Used ONLY by the Network Security
// module — configured IPs are scanned instead of DNS-resolving the domain
// (fixes CDN/WAF edge IPs). Mutations resync the authoritative list so the
// server-side single-primary rule is reflected exactly.

export const fetchNetworkTargets = createAsyncThunk(
    'adminDomains/fetchNetworkTargets',
    async ({ companyId, domainId }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/domains/${domainId}/network-targets`, API_CONFIG);
            return { companyId, domainId, targets: res.data?.data ?? [] };
        } catch (e) { return rejectWithValue({ companyId, error: errorOf(e) }); }
    },
);

export const addNetworkTarget = createAsyncThunk(
    'adminDomains/addNetworkTarget',
    async ({ companyId, domainId, payload }, { dispatch, rejectWithValue }) => {
        try {
            await apiRequest.post(`/admin/domains/${domainId}/network-targets`, payload, API_CONFIG);
            toast.success('Target IP added');
            await dispatch(fetchNetworkTargets({ companyId, domainId }));
            return { companyId, domainId };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ companyId, error: errorOf(e) });
        }
    },
);

export const updateNetworkTarget = createAsyncThunk(
    'adminDomains/updateNetworkTarget',
    async ({ companyId, domainId, targetId, payload }, { dispatch, rejectWithValue }) => {
        try {
            await apiRequest.put(`/admin/network-targets/${targetId}`, payload, API_CONFIG);
            toast.success('Target IP updated');
            await dispatch(fetchNetworkTargets({ companyId, domainId }));
            return { companyId, domainId };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ companyId, error: errorOf(e) });
        }
    },
);

export const removeNetworkTarget = createAsyncThunk(
    'adminDomains/removeNetworkTarget',
    async ({ companyId, domainId, targetId }, { dispatch, rejectWithValue }) => {
        try {
            await apiRequest.delete(`/admin/network-targets/${targetId}`, API_CONFIG);
            toast.success('Target IP removed');
            await dispatch(fetchNetworkTargets({ companyId, domainId }));
            return { companyId, domainId };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ companyId, error: errorOf(e) });
        }
    },
);

// ── Slice ─────────────────────────────────────────────────────────────────

const slice = createSlice({
    name: 'adminDomains',
    initialState: {
        byCompany: {},          // { [companyId]: { list, license, meta, loading, error } }
        lastBulkResult: null,   // surfaces "X added / Y skipped" detail in the UI
    },
    reducers: {
        clearBulkResult: (s) => { s.lastBulkResult = null; },
    },
    extraReducers: (b) => {
        b
            .addCase(fetchCompanyDomains.pending,   (s, a) => {
                const cid = a.meta.arg.companyId;
                s.byCompany[cid] = { ...(s.byCompany[cid] ?? {}), loading: true, error: null };
            })
            .addCase(fetchCompanyDomains.fulfilled, (s, a) => {
                const { companyId, list, license, meta } = a.payload;
                s.byCompany[companyId] = { list, license, meta, loading: false, error: null };
            })
            .addCase(fetchCompanyDomains.rejected,  (s, a) => {
                const cid = a.payload?.companyId ?? a.meta.arg.companyId;
                if (!cid) return;
                s.byCompany[cid] = { ...(s.byCompany[cid] ?? {}), loading: false, error: a.payload?.error };
            })

            .addCase(addCompanyDomain.fulfilled, (s, a) => {
                const { companyId, domain } = a.payload;
                const slot = s.byCompany[companyId];
                if (slot && domain) slot.list = [domain, ...(slot.list ?? [])];
            })

            .addCase(bulkAddDomains.fulfilled, (s, a) => {
                const { companyId, result } = a.payload;
                s.lastBulkResult = result;
                const slot = s.byCompany[companyId];
                if (slot && result?.created?.length) {
                    slot.list = [...result.created, ...(slot.list ?? [])];
                }
            })

            .addCase(updateDomain.fulfilled, (s, a) => {
                patchDomain(s, a.payload.companyId, a.payload.domain);
            })
            .addCase(toggleDomainScope.fulfilled, (s, a) => {
                patchDomain(s, a.payload.companyId, a.payload.domain);
            })

            .addCase(removeDomain.fulfilled, (s, a) => {
                const slot = s.byCompany[a.payload.companyId];
                if (slot) slot.list = (slot.list ?? []).filter((d) => d.id !== a.payload.domainId);
            })

            .addCase(fetchNetworkTargets.fulfilled, (s, a) => {
                const { companyId, domainId, targets } = a.payload;
                patchDomain(s, companyId, { id: domainId, network_targets: targets });
            });
    },
});

function patchDomain(state, companyId, domain) {
    const slot = state.byCompany[companyId];
    if (!slot || !domain) return;
    const i = (slot.list ?? []).findIndex((d) => d.id === domain.id);
    if (i !== -1) slot.list[i] = { ...slot.list[i], ...domain };
}

export const { clearBulkResult } = slice.actions;
export default slice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────
export const selectCompanyDomains          = (s, cid) => s.adminDomains.byCompany[cid]?.list    ?? [];
export const selectCompanyDomainsLicense   = (s, cid) => s.adminDomains.byCompany[cid]?.license ?? null;
export const selectCompanyDomainsLoading   = (s, cid) => s.adminDomains.byCompany[cid]?.loading ?? false;
export const selectCompanyDomainsError     = (s, cid) => s.adminDomains.byCompany[cid]?.error   ?? null;
export const selectLastBulkResult          = (s) => s.adminDomains.lastBulkResult;
