import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Takedown control request failed';

export const fetchTakedownControl = createAsyncThunk('takedownControl/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/takedown-control', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

// case-level: submit/escalate/resolve/force-close
export const takedownCaseAction = createAsyncThunk('takedownControl/caseAction',
    async ({ id, action, body = {} }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/takedown-control/${id}/${action}`, body, CFG);
            return { data: res.data, status: res.status };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

// create a case (optionally with target URLs → orchestrator creates targets)
export const createTakedownCase = createAsyncThunk('takedownControl/create',
    async (body, { rejectWithValue }) => {
        try { const res = await apiRequest.post('/admin/takedown-control', body, CFG); return res.data; }
        catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchTakedownTimeline = createAsyncThunk('takedownControl/timeline',
    async (id, { rejectWithValue }) => {
        try { const res = await apiRequest.get(`/admin/takedown-control/${id}/timeline`, CFG); return { id, events: res.data?.data ?? [] }; }
        catch (e) { return rejectWithValue({ id, error: errOf(e) }); }
    });

const slice = createSlice({
    name: 'adminTakedownControl',
    initialState: { list: [], meta: null, timelineById: {}, loading: false, acting: false, lastError: null },
    reducers: { clearTakedownControlError: (s) => { s.lastError = null; } },
    extraReducers: (b) => {
        b.addCase(fetchTakedownControl.pending, (s) => { s.loading = true; })
         .addCase(fetchTakedownControl.fulfilled, (s, a) => { s.loading = false; s.list = a.payload.list; s.meta = a.payload.meta; })
         .addCase(fetchTakedownControl.rejected, (s, a) => { s.loading = false; s.lastError = a.payload; })
         .addCase(takedownCaseAction.pending, (s) => { s.acting = true; })
         .addCase(takedownCaseAction.fulfilled, (s) => { s.acting = false; })
         .addCase(takedownCaseAction.rejected, (s, a) => { s.acting = false; s.lastError = a.payload; })
         .addCase(fetchTakedownTimeline.fulfilled, (s, a) => { s.timelineById[a.payload.id] = a.payload.events; });
    },
});
export const { clearTakedownControlError } = slice.actions;
export default slice.reducer;
export const selectTakedownControl = (s) => s.adminTakedownControl.list;
export const selectTakedownControlMeta = (s) => s.adminTakedownControl.meta;
export const selectTakedownControlLoading = (s) => s.adminTakedownControl.loading;
export const selectTakedownControlActing = (s) => s.adminTakedownControl.acting;
export const selectTakedownTimeline = (s, id) => s.adminTakedownControl.timelineById[id] ?? null;
