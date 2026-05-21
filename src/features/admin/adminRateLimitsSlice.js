import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Rate-limit request failed';

export const fetchRateLimits = createAsyncThunk('adminRateLimits/fetch',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/rate-limits', CFG);
            return res.data?.data ?? [];
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchCompanyRateLimits = createAsyncThunk('adminRateLimits/forCompany',
    async (companyId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/rate-limits`, CFG);
            return { companyId, list: res.data?.data ?? [] };
        } catch (e) { return rejectWithValue({ companyId, error: errOf(e) }); }
    });

export const setRateLimit = createAsyncThunk('adminRateLimits/set',
    async ({ companyId, bucket, limitPerMinute, reason, expiresAt }, { rejectWithValue, dispatch }) => {
        try {
            const res = await apiRequest.post(`/admin/companies/${companyId}/rate-limits`,
                { bucket, limit_per_minute: limitPerMinute, reason, expires_at: expiresAt }, CFG);
            toast.success('Rate limit set');
            dispatch(fetchCompanyRateLimits(companyId));
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const removeRateLimit = createAsyncThunk('adminRateLimits/remove',
    async ({ overrideId, companyId }, { rejectWithValue, dispatch }) => {
        try {
            await apiRequest.delete(`/admin/rate-limits/${overrideId}`, CFG);
            toast.success('Override removed');
            if (companyId) dispatch(fetchCompanyRateLimits(companyId));
            return overrideId;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminRateLimits',
    initialState: { list: [], byCompany: {}, loading: false },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchRateLimits.pending,   (s) => { s.loading = true; })
            .addCase(fetchRateLimits.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; })
            .addCase(fetchCompanyRateLimits.fulfilled, (s, a) => {
                s.byCompany[a.payload.companyId] = a.payload.list;
            });
    },
});

export default slice.reducer;
export const selectRateLimits        = (s) => s.adminRateLimits.list;
export const selectRateLimitsLoading = (s) => s.adminRateLimits.loading;
export const selectCompanyRateLimits = (s, cid) => s.adminRateLimits.byCompany[cid] ?? [];
