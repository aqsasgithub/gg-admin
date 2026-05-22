import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

/**
 * adminLicenseApplicationsSlice — Pass B / Task 5 frontend.
 *
 * Lists customer-initiated license applications, lets an admin
 * approve (which provisions a CompanyLicense) or reject (which
 * closes the application with a note). Revoke of a live license
 * is also handled here since it shares the same workflow surface.
 */

const API_CONFIG = { showSuccessToast: false, showErrorToast: false };
const errorOf = (e) => e?.response?.data?.message || e?.message || 'License application request failed';

// ── Thunks ────────────────────────────────────────────────────────────────

export const fetchLicenseApplications = createAsyncThunk(
    'adminLicenseApplications/fetchAll',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/license-applications', { ...API_CONFIG, params });
            return { data: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errorOf(e)); }
    },
);

export const fetchLicenseApplication = createAsyncThunk(
    'adminLicenseApplications/fetchOne',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/license-applications/${id}`, API_CONFIG);
            return res.data?.data;
        } catch (e) { return rejectWithValue(errorOf(e)); }
    },
);

export const approveLicenseApplication = createAsyncThunk(
    'adminLicenseApplications/approve',
    async ({ id, payload }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(
                `/admin/license-applications/${id}/approve`,
                payload || {},
                API_CONFIG,
            );
            toast.success('Application approved — license issued.');
            return res.data?.data;
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue(errorOf(e));
        }
    },
);

export const rejectLicenseApplication = createAsyncThunk(
    'adminLicenseApplications/reject',
    async ({ id, admin_note }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(
                `/admin/license-applications/${id}/reject`,
                { admin_note },
                API_CONFIG,
            );
            toast.success('Application rejected.');
            return res.data?.data;
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue(errorOf(e));
        }
    },
);

export const revokeLicense = createAsyncThunk(
    'adminLicenseApplications/revokeLicense',
    async ({ id, admin_note }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(
                `/admin/licenses/${id}/revoke`,
                { admin_note },
                API_CONFIG,
            );
            toast.success('License revoked.');
            return res.data?.data;
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue(errorOf(e));
        }
    },
);

// ── Slice ─────────────────────────────────────────────────────────────────

const initialState = {
    list:     [],
    meta:     null,
    loading:  false,
    error:    null,

    detail:        null,
    detailLoading: false,
    detailError:   null,

    acting: false,  // approve / reject / revoke in-flight
};

const slice = createSlice({
    name: 'adminLicenseApplications',
    initialState,
    reducers: {
        clearDetail(state) { state.detail = null; state.detailError = null; },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchLicenseApplications.pending, (s) => { s.loading = true; s.error = null; })
            .addCase(fetchLicenseApplications.fulfilled, (s, a) => {
                s.loading = false;
                s.list = a.payload.data;
                s.meta = a.payload.meta;
            })
            .addCase(fetchLicenseApplications.rejected, (s, a) => { s.loading = false; s.error = a.payload; })

            .addCase(fetchLicenseApplication.pending, (s) => { s.detailLoading = true; s.detailError = null; })
            .addCase(fetchLicenseApplication.fulfilled, (s, a) => { s.detailLoading = false; s.detail = a.payload; })
            .addCase(fetchLicenseApplication.rejected, (s, a) => { s.detailLoading = false; s.detailError = a.payload; })

            .addCase(approveLicenseApplication.pending, (s) => { s.acting = true; })
            .addCase(approveLicenseApplication.fulfilled, (s, a) => {
                s.acting = false;
                const updated = a.payload?.application;
                if (updated) {
                    s.list = s.list.map((r) => r.id === updated.id ? { ...r, ...updated } : r);
                    if (s.detail?.application?.id === updated.id) {
                        s.detail = { ...s.detail, application: updated, current_license: a.payload?.license || s.detail.current_license };
                    }
                }
            })
            .addCase(approveLicenseApplication.rejected, (s) => { s.acting = false; })

            .addCase(rejectLicenseApplication.pending, (s) => { s.acting = true; })
            .addCase(rejectLicenseApplication.fulfilled, (s, a) => {
                s.acting = false;
                const updated = a.payload;
                if (updated) {
                    s.list = s.list.map((r) => r.id === updated.id ? { ...r, ...updated } : r);
                    if (s.detail?.application?.id === updated.id) {
                        s.detail = { ...s.detail, application: updated };
                    }
                }
            })
            .addCase(rejectLicenseApplication.rejected, (s) => { s.acting = false; })

            .addCase(revokeLicense.pending, (s) => { s.acting = true; })
            .addCase(revokeLicense.fulfilled, (s, a) => {
                s.acting = false;
                if (s.detail?.current_license?.id === a.payload?.id) {
                    s.detail = { ...s.detail, current_license: a.payload };
                }
            })
            .addCase(revokeLicense.rejected, (s) => { s.acting = false; });
    },
});

export const { clearDetail } = slice.actions;
export default slice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────

export const selectApplications        = (s) => s.adminLicenseApplications.list;
export const selectApplicationsMeta    = (s) => s.adminLicenseApplications.meta;
export const selectApplicationsLoading = (s) => s.adminLicenseApplications.loading;
export const selectApplicationsError   = (s) => s.adminLicenseApplications.error;
export const selectApplicationDetail   = (s) => s.adminLicenseApplications.detail;
export const selectActing              = (s) => s.adminLicenseApplications.acting;
