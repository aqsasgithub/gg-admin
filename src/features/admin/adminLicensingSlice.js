import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

/**
 * adminLicensingSlice — license plans and module entitlements.
 *
 * The slice is keyed by companyId for license + entitlement data so the
 * UI can navigate between customers without re-fetching everything.
 * Plans are a singleton (one fetch, cached forever).
 */

const API_CONFIG = { showSuccessToast: false, showErrorToast: false };
const errorOf = (e) => e?.response?.data?.message || e?.message || 'License request failed';

// ── Thunks ────────────────────────────────────────────────────────────────

export const fetchPlans = createAsyncThunk(
    'adminLicensing/fetchPlans',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/licenses/plans', API_CONFIG);
            return res.data?.data;
        } catch (e) { return rejectWithValue(errorOf(e)); }
    },
    { condition: (_, { getState }) => !getState().adminLicensing.plans }
);

export const fetchAllLicenses = createAsyncThunk(
    'adminLicensing/fetchAllLicenses',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/licenses', { ...API_CONFIG, params });
            return { data: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errorOf(e)); }
    },
);

export const fetchCompanyLicense = createAsyncThunk(
    'adminLicensing/fetchCompanyLicense',
    async (companyId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/license`, API_CONFIG);
            return { companyId, data: res.data?.data };
        } catch (e) { return rejectWithValue({ companyId, error: errorOf(e) }); }
    },
);

export const fetchCompanyEntitlements = createAsyncThunk(
    'adminLicensing/fetchCompanyEntitlements',
    async (companyId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/entitlements`, API_CONFIG);
            return { companyId, data: res.data?.data ?? [] };
        } catch (e) { return rejectWithValue({ companyId, error: errorOf(e) }); }
    },
);

export const updateCompanyLicense = createAsyncThunk(
    'adminLicensing/updateCompanyLicense',
    async ({ companyId, payload }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.put(`/admin/companies/${companyId}/license`, payload, API_CONFIG);
            toast.success('License updated');
            return { companyId, data: res.data?.data };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ companyId, error: errorOf(e) });
        }
    },
);

export const replaceEntitlements = createAsyncThunk(
    'adminLicensing/replaceEntitlements',
    async ({ companyId, entitlements }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.put(`/admin/companies/${companyId}/entitlements`, {
                entitlements,
            }, API_CONFIG);
            toast.success('Modules updated');
            return { companyId, data: res.data?.data ?? [] };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ companyId, error: errorOf(e) });
        }
    },
);

export const toggleEntitlement = createAsyncThunk(
    'adminLicensing/toggleEntitlement',
    async ({ companyId, module, enabled }, { rejectWithValue }) => {
        try {
            await apiRequest.post(`/admin/companies/${companyId}/entitlements/toggle`, {
                module, enabled,
            }, API_CONFIG);
            return { companyId, module, enabled };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ companyId, error: errorOf(e) });
        }
    },
);

// ── Slice ─────────────────────────────────────────────────────────────────

const initial = {
    plans:               null,
    list:                [],
    meta:                null,
    licenseByCompany:    {},
    entitlementsByCompany: {},
    loadingPlans:        false,
    loadingList:         false,
    error:               null,
};

const slice = createSlice({
    name: 'adminLicensing',
    initialState: initial,
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchPlans.pending,   (s) => { s.loadingPlans = true; })
            .addCase(fetchPlans.fulfilled, (s, a) => { s.loadingPlans = false; s.plans = a.payload; })
            .addCase(fetchPlans.rejected,  (s, a) => { s.loadingPlans = false; s.error = a.payload; })

            .addCase(fetchAllLicenses.pending,    (s) => { s.loadingList = true; })
            .addCase(fetchAllLicenses.fulfilled,  (s, a) => {
                s.loadingList = false;
                s.list = a.payload.data;
                s.meta = a.payload.meta;
            })
            .addCase(fetchAllLicenses.rejected,   (s, a) => { s.loadingList = false; s.error = a.payload; })

            .addCase(fetchCompanyLicense.fulfilled, (s, a) => {
                s.licenseByCompany[a.payload.companyId] = a.payload.data;
            })
            .addCase(updateCompanyLicense.fulfilled, (s, a) => {
                s.licenseByCompany[a.payload.companyId] = a.payload.data;
                // Patch the list row too so the table reflects the change.
                const i = s.list.findIndex((l) => l.company_id === a.payload.companyId);
                if (i !== -1) s.list[i] = { ...s.list[i], ...a.payload.data };
            })

            .addCase(fetchCompanyEntitlements.fulfilled, (s, a) => {
                s.entitlementsByCompany[a.payload.companyId] = a.payload.data;
            })
            .addCase(replaceEntitlements.fulfilled, (s, a) => {
                s.entitlementsByCompany[a.payload.companyId] = a.payload.data;
            })
            .addCase(toggleEntitlement.fulfilled, (s, a) => {
                const list = s.entitlementsByCompany[a.payload.companyId];
                if (!list) return;
                const i = list.findIndex((e) => e.module === a.payload.module);
                if (i !== -1) list[i] = { ...list[i], enabled: a.payload.enabled };
            });
    },
});

export default slice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────
export const selectPlans                = (s) => s.adminLicensing.plans;
export const selectAllLicenses          = (s) => s.adminLicensing.list;
export const selectAllLicensesMeta      = (s) => s.adminLicensing.meta;
export const selectCompanyLicense       = (s, cid) => s.adminLicensing.licenseByCompany[cid] ?? null;
export const selectCompanyEntitlements  = (s, cid) => s.adminLicensing.entitlementsByCompany[cid] ?? null;
export const selectLicensingLoading     = (s) => s.adminLicensing.loadingList;
