import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Impersonation failed';

export const startImpersonation = createAsyncThunk('adminImpersonation/start',
    async ({ userId, reason, durationMinutes }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/impersonation',
                { user_id: userId, reason, duration_minutes: durationMinutes }, CFG);
            toast.success('Impersonation session started');
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const fetchImpersonationSessions = createAsyncThunk('adminImpersonation/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/impersonation', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchImpersonationSession = createAsyncThunk('adminImpersonation/fetchOne',
    async (sessionId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/impersonation/${sessionId}`, CFG);
            return { id: sessionId, detail: res.data?.data };
        } catch (e) { return rejectWithValue({ id: sessionId, error: errOf(e) }); }
    });

export const endImpersonation = createAsyncThunk('adminImpersonation/end',
    async (sessionId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/impersonation/${sessionId}/end`, {}, CFG);
            toast.success('Session ended');
            return { id: sessionId, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminImpersonation',
    initialState: { list: [], meta: null, loading: false, byId: {}, lastStarted: null, error: null },
    reducers: {
        clearLastStarted: (s) => { s.lastStarted = null; },
    },
    extraReducers: (b) => {
        b
            .addCase(startImpersonation.fulfilled, (s, a) => { s.lastStarted = a.payload; })
            .addCase(fetchImpersonationSessions.pending,   (s) => { s.loading = true; })
            .addCase(fetchImpersonationSessions.fulfilled, (s, a) => { s.loading = false; s.list = a.payload.list; s.meta = a.payload.meta; })
            .addCase(fetchImpersonationSessions.rejected,  (s) => { s.loading = false; })
            .addCase(fetchImpersonationSession.fulfilled,  (s, a) => { s.byId[a.payload.id] = a.payload.detail; })
            .addCase(endImpersonation.fulfilled, (s, a) => {
                const { id, detail } = a.payload;
                if (detail) {
                    s.byId[id] = detail;
                    s.list = s.list.map((r) => r.id === id ? { ...r, ...detail } : r);
                }
            });
    },
});

export const { clearLastStarted } = slice.actions;
export default slice.reducer;

export const selectImpersonationSessions = (s) => s.adminImpersonation.list;
export const selectImpersonationLoading  = (s) => s.adminImpersonation.loading;
export const selectImpersonationSession  = (s, id) => s.adminImpersonation.byId[id] ?? null;
export const selectLastStartedImpersonation = (s) => s.adminImpersonation.lastStarted;
