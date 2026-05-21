import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

/**
 * adminCompaniesSlice — cross-tenant company administration.
 *
 * The list view operates over the platform-wide set; the detail view is
 * keyed by company id and stores the rich payload (company, license,
 * entitlements, stats, recent_activity) returned by AdminCompanyController::show.
 */

const API_CONFIG = { showSuccessToast: false, showErrorToast: false };
const errorOf = (e) => e?.response?.data?.message || e?.message || 'Admin company request failed';

// ── Thunks ────────────────────────────────────────────────────────────────

export const fetchAdminCompanies = createAsyncThunk(
    'adminCompanies/fetchAdminCompanies',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/companies', { ...API_CONFIG, params });
            return { data: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errorOf(e)); }
    },
);

export const fetchAdminCompany = createAsyncThunk(
    'adminCompanies/fetchAdminCompany',
    async (companyId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}`, API_CONFIG);
            return { companyId, data: res.data?.data };
        } catch (e) { return rejectWithValue({ companyId, error: errorOf(e) }); }
    },
);

export const createAdminCompany = createAsyncThunk(
    'adminCompanies/createAdminCompany',
    async (payload, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/companies', payload, API_CONFIG);
            toast.success(`Created ${payload.name}`);
            return res.data?.data;
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue(errorOf(e));
        }
    },
);

export const updateAdminCompany = createAsyncThunk(
    'adminCompanies/updateAdminCompany',
    async ({ companyId, payload }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.put(`/admin/companies/${companyId}`, payload, API_CONFIG);
            toast.success('Company updated');
            return { companyId, data: res.data?.data };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ companyId, error: errorOf(e) });
        }
    },
);

export const suspendCompany = createAsyncThunk(
    'adminCompanies/suspendCompany',
    async ({ companyId, reason }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/companies/${companyId}/suspend`, { reason }, API_CONFIG);
            toast.success('Company suspended');
            return { companyId, license: res.data?.data };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ companyId, error: errorOf(e) });
        }
    },
);

export const reinstateCompany = createAsyncThunk(
    'adminCompanies/reinstateCompany',
    async (companyId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/companies/${companyId}/reinstate`, {}, API_CONFIG);
            toast.success('Company reinstated');
            return { companyId, license: res.data?.data };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ companyId, error: errorOf(e) });
        }
    },
);

export const deleteAdminCompany = createAsyncThunk(
    'adminCompanies/deleteAdminCompany',
    async (companyId, { rejectWithValue }) => {
        try {
            await apiRequest.delete(`/admin/companies/${companyId}`, API_CONFIG);
            toast.success('Company deleted');
            return { companyId };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ companyId, error: errorOf(e) });
        }
    },
);

// ── Slice ─────────────────────────────────────────────────────────────────

const initial = {
    list:    [],
    meta:    null,
    byId:    {},
    loading: false,
    error:   null,
    working: {},
};

const slice = createSlice({
    name: 'adminCompanies',
    initialState: initial,
    reducers: {
        clearAdminCompanyError: (s) => { s.error = null; },
    },
    extraReducers: (b) => {
        b
            .addCase(fetchAdminCompanies.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(fetchAdminCompanies.fulfilled, (s, a) => {
                s.loading = false;
                s.list = a.payload.data;
                s.meta = a.payload.meta;
            })
            .addCase(fetchAdminCompanies.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            .addCase(fetchAdminCompany.fulfilled,   (s, a) => {
                if (a.payload?.companyId) s.byId[a.payload.companyId] = a.payload.data;
            })

            .addCase(updateAdminCompany.fulfilled,  (s, a) => {
                const updated = a.payload.data;
                if (!updated?.id) return;
                const i = s.list.findIndex((c) => c.id === updated.id);
                if (i !== -1) s.list[i] = { ...s.list[i], ...updated };
                if (s.byId[updated.id]) {
                    s.byId[updated.id] = {
                        ...s.byId[updated.id],
                        company: { ...s.byId[updated.id].company, ...updated },
                    };
                }
            })

            .addCase(suspendCompany.pending,    (s, a) => { s.working[a.meta.arg.companyId] = 'suspend'; })
            .addCase(suspendCompany.fulfilled,  (s, a) => {
                delete s.working[a.payload.companyId];
                patchLicense(s, a.payload.companyId, a.payload.license);
            })
            .addCase(suspendCompany.rejected,   (s, a) => { delete s.working[a.meta.arg.companyId]; })

            .addCase(reinstateCompany.pending,    (s, a) => { s.working[a.meta.arg] = 'reinstate'; })
            .addCase(reinstateCompany.fulfilled,  (s, a) => {
                delete s.working[a.payload.companyId];
                patchLicense(s, a.payload.companyId, a.payload.license);
            })
            .addCase(reinstateCompany.rejected,   (s, a) => { delete s.working[a.meta.arg]; })

            .addCase(deleteAdminCompany.fulfilled, (s, a) => {
                s.list = s.list.filter((c) => c.id !== a.payload.companyId);
                delete s.byId[a.payload.companyId];
            });
    },
});

function patchLicense(state, companyId, license) {
    if (!license) return;
    const i = state.list.findIndex((c) => c.id === companyId);
    if (i !== -1) state.list[i] = {
        ...state.list[i],
        license: {
            plan:           license.plan,
            status:         license.status,
            expires_at:     license.expires_at,
            seats_limit:    license.seats_limit,
            domains_limit:  license.domains_limit,
        },
    };
    if (state.byId[companyId]) state.byId[companyId] = { ...state.byId[companyId], license };
}

export const { clearAdminCompanyError } = slice.actions;
export default slice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────
export const selectAdminCompanies        = (s) => s.adminCompanies.list;
export const selectAdminCompaniesMeta    = (s) => s.adminCompanies.meta;
export const selectAdminCompaniesLoading = (s) => s.adminCompanies.loading;
export const selectAdminCompaniesError   = (s) => s.adminCompanies.error;
export const selectAdminCompanyById      = (s, id) => s.adminCompanies.byId[id] ?? null;
export const selectAdminCompanyWorking   = (s, id) => s.adminCompanies.working[id] ?? null;
