import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

/**
 * adminActivitySlice — platform-wide and per-company activity feeds.
 *
 * The backend (AdminActivityController) merges scans / alerts / takedowns
 * / audit events into a single sorted stream and time-buckets it for
 * the dashboard sparkline. We cache per-company feeds keyed by company id.
 */

const API_CONFIG = { showSuccessToast: false, showErrorToast: false };
const errorOf = (e) => e?.response?.data?.message || e?.message || 'Activity request failed';

export const fetchPlatformActivity = createAsyncThunk(
    'adminActivity/fetchPlatformActivity',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/activity', { ...API_CONFIG, params });
            return res.data?.data;
        } catch (e) { return rejectWithValue(errorOf(e)); }
    },
);

export const fetchCompanyActivity = createAsyncThunk(
    'adminActivity/fetchCompanyActivity',
    async ({ companyId, ...params }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/activity`, { ...API_CONFIG, params });
            return { companyId, data: res.data?.data };
        } catch (e) { return rejectWithValue({ companyId, error: errorOf(e) }); }
    },
);

const slice = createSlice({
    name: 'adminActivity',
    initialState: {
        platform:  { feed: [], buckets: [], loading: false, error: null },
        byCompany: {},
    },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchPlatformActivity.pending,   (s) => { s.platform.loading = true; s.platform.error = null; })
            .addCase(fetchPlatformActivity.fulfilled, (s, a) => {
                s.platform.loading = false;
                s.platform.feed    = a.payload?.feed    ?? [];
                s.platform.buckets = a.payload?.buckets ?? [];
            })
            .addCase(fetchPlatformActivity.rejected,  (s, a) => {
                s.platform.loading = false;
                s.platform.error = a.payload;
            })

            .addCase(fetchCompanyActivity.pending,   (s, a) => {
                const cid = a.meta.arg.companyId;
                s.byCompany[cid] = { feed: [], loading: true, error: null, ...(s.byCompany[cid] ?? {}) };
                s.byCompany[cid].loading = true;
            })
            .addCase(fetchCompanyActivity.fulfilled, (s, a) => {
                const { companyId, data } = a.payload;
                s.byCompany[companyId] = {
                    feed:    data?.feed ?? [],
                    loading: false,
                    error:   null,
                };
            })
            .addCase(fetchCompanyActivity.rejected,  (s, a) => {
                const cid = a.payload?.companyId ?? a.meta.arg.companyId;
                if (!cid) return;
                s.byCompany[cid] = { ...(s.byCompany[cid] ?? {}), loading: false, error: a.payload?.error };
            });
    },
});

export default slice.reducer;

export const selectPlatformActivity        = (s) => s.adminActivity.platform.feed;
export const selectPlatformBuckets         = (s) => s.adminActivity.platform.buckets;
export const selectPlatformActivityLoading = (s) => s.adminActivity.platform.loading;
export const selectCompanyActivity         = (s, cid) => s.adminActivity.byCompany[cid]?.feed ?? null;
export const selectCompanyActivityLoading  = (s, cid) => s.adminActivity.byCompany[cid]?.loading ?? false;
