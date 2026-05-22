import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

// Mirrors the convention used across the admin slices: thunks stay quiet
// (no toasts) and components decide how to surface success/failure.
const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Findings request failed';

export const fetchFindings = createAsyncThunk('adminFindings/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/findings', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchFinding = createAsyncThunk('adminFindings/fetchOne',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/findings/${id}`, CFG);
            return { id, detail: res.data?.data };
        } catch (e) { return rejectWithValue({ id, error: errOf(e) }); }
    });

export const updateFindingGovernance = createAsyncThunk('adminFindings/update',
    async ({ id, body }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.put(`/admin/findings/${id}`, body, CFG);
            return { id, data: res.data?.data };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

// One thunk drives every single-finding action endpoint
// (publish/unpublish/suppress/false-positive/accept-risk/restore/note/customer-text).
export const findingAction = createAsyncThunk('adminFindings/action',
    async ({ id, action, body = {} }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/findings/${id}/${action}`, body, CFG);
            return { id, action, data: res.data, status: res.status };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const bulkFindingAction = createAsyncThunk('adminFindings/bulk',
    async (body, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/findings/bulk', body, CFG);
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchFindingTrace = createAsyncThunk('adminFindings/trace',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/trace/finding/${id}`, CFG);
            return { id, trace: res.data?.data };
        } catch (e) { return rejectWithValue({ id, error: errOf(e) }); }
    });

const slice = createSlice({
    name: 'adminFindings',
    initialState: {
        list: [], meta: null, byId: {}, traceById: {},
        loading: false, acting: false, lastBulk: null, lastError: null,
    },
    reducers: {
        clearFindingError: (s) => { s.lastError = null; },
    },
    extraReducers: (b) => {
        b
            .addCase(fetchFindings.pending,   (s) => { s.loading = true; })
            .addCase(fetchFindings.fulfilled, (s, a) => { s.loading = false; s.list = a.payload.list; s.meta = a.payload.meta; })
            .addCase(fetchFindings.rejected,  (s, a) => { s.loading = false; s.lastError = a.payload; })

            .addCase(fetchFinding.fulfilled,  (s, a) => { s.byId[a.payload.id] = a.payload.detail; })
            .addCase(fetchFindingTrace.fulfilled, (s, a) => { s.traceById[a.payload.id] = a.payload.trace; })

            .addCase(updateFindingGovernance.pending,  (s) => { s.acting = true; })
            .addCase(updateFindingGovernance.fulfilled,(s) => { s.acting = false; })
            .addCase(updateFindingGovernance.rejected, (s, a) => { s.acting = false; s.lastError = a.payload; })

            .addCase(findingAction.pending,   (s) => { s.acting = true; })
            .addCase(findingAction.fulfilled, (s) => { s.acting = false; })
            .addCase(findingAction.rejected,  (s, a) => { s.acting = false; s.lastError = a.payload; })

            .addCase(bulkFindingAction.fulfilled, (s, a) => { s.lastBulk = a.payload; });
    },
});

export const { clearFindingError } = slice.actions;
export default slice.reducer;

export const selectFindings        = (s) => s.adminFindings.list;
export const selectFindingsMeta    = (s) => s.adminFindings.meta;
export const selectFindingsLoading = (s) => s.adminFindings.loading;
export const selectFindingActing   = (s) => s.adminFindings.acting;
export const selectFinding         = (s, id) => s.adminFindings.byId[id] ?? null;
export const selectFindingTrace    = (s, id) => s.adminFindings.traceById[id] ?? null;
export const selectFindingsError   = (s) => s.adminFindings.lastError;
export const selectLastBulk        = (s) => s.adminFindings.lastBulk;
