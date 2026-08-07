import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

/**
 * Email delivery logs — reads /api/admin/email-logs/*.
 *
 * Every outgoing email (invitation, OTP, password reset, report, notification)
 * is captured centrally on the server via Laravel mail events, so this is a
 * read + resend surface only; there is no create path. Resend is owner-gated
 * (email_logs.resend) and creates a NEW linked log rather than mutating the
 * original, preserving the audit chain.
 */

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Email log request failed';

export const fetchEmailLogs = createAsyncThunk(
    'emailLogs/fetch',
    async ({ filters = {}, page = 1 } = {}, { rejectWithValue }) => {
        try {
            const params = { page };
            Object.entries(filters).forEach(([k, v]) => { if (v !== '' && v != null) params[k] = v; });
            const res = await apiRequest.get('/admin/email-logs', { ...CFG, params });
            return { data: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    },
);

export const fetchEmailLogStats = createAsyncThunk(
    'emailLogs/stats',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/email-logs/stats', CFG);
            return res.data?.data ?? null;
        } catch (e) { return rejectWithValue(errOf(e)); }
    },
);

export const fetchEmailLogDetail = createAsyncThunk(
    'emailLogs/detail',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/email-logs/${id}`, CFG);
            return res.data?.data ?? null;
        } catch (e) { return rejectWithValue(errOf(e)); }
    },
);

export const resendEmailLog = createAsyncThunk(
    'emailLogs/resend',
    async (id, { dispatch, getState, rejectWithValue }) => {
        try {
            await apiRequest.post(`/admin/email-logs/${id}/resend`, {}, CFG);
            toast.success('Resend dispatched');
            const st = getState().emailLogs;
            dispatch(fetchEmailLogs({ filters: st.filters, page: st.page }));
            dispatch(fetchEmailLogStats());
            return true;
        } catch (e) {
            const msg = errOf(e);
            toast.error(msg);
            return rejectWithValue(msg);
        }
    },
);

const initialState = {
    list:      [],
    meta:      null,
    stats:     null,
    detail:    null,
    loading:   false,
    resending: null,   // id currently being resent
    error:     null,
    filters:   { status: '', email_type: '', q: '' },
    page:      1,
};

const slice = createSlice({
    name: 'emailLogs',
    initialState,
    reducers: {
        setEmailLogFilter(state, action) {
            const { key, value } = action.payload;
            state.filters[key] = value;
            state.page = 1;
        },
        clearEmailLogFilters(state) {
            state.filters = { ...initialState.filters };
            state.page = 1;
        },
        setEmailLogPage(state, action) {
            state.page = Math.max(1, Number(action.payload) || 1);
        },
        openEmailLogDetail(state, action) {
            state.detail = action.payload ?? null;
        },
        closeEmailLogDetail(state) {
            state.detail = null;
        },
    },
    extraReducers: (b) => {
        b
            .addCase(fetchEmailLogs.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(fetchEmailLogs.fulfilled, (s, a) => { s.loading = false; s.list = a.payload.data; s.meta = a.payload.meta; })
            .addCase(fetchEmailLogs.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            .addCase(fetchEmailLogStats.fulfilled, (s, a) => { s.stats = a.payload; })

            .addCase(fetchEmailLogDetail.fulfilled, (s, a) => { s.detail = a.payload; })

            .addCase(resendEmailLog.pending,   (s, a) => { s.resending = a.meta.arg; })
            .addCase(resendEmailLog.fulfilled, (s) => { s.resending = null; })
            .addCase(resendEmailLog.rejected,  (s) => { s.resending = null; });
    },
});

export const {
    setEmailLogFilter, clearEmailLogFilters, setEmailLogPage,
    openEmailLogDetail, closeEmailLogDetail,
} = slice.actions;

export const selectEmailLogs        = (st) => st.emailLogs.list;
export const selectEmailLogMeta     = (st) => st.emailLogs.meta;
export const selectEmailLogStats    = (st) => st.emailLogs.stats;
export const selectEmailLogDetail   = (st) => st.emailLogs.detail;
export const selectEmailLogLoading  = (st) => st.emailLogs.loading;
export const selectEmailLogResending = (st) => st.emailLogs.resending;
export const selectEmailLogError    = (st) => st.emailLogs.error;
export const selectEmailLogFilters  = (st) => st.emailLogs.filters;
export const selectEmailLogPage     = (st) => st.emailLogs.page;

export default slice.reducer;
