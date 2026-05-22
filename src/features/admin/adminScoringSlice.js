import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Scoring request failed';

export const previewScore = createAsyncThunk('adminScoring/preview',
    async (body, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/scoring/preview', body, CFG);
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const recalcScore = createAsyncThunk('adminScoring/recalc',
    async ({ targetType, id, body = {} }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/scoring/${targetType}/${id}/recalculate`, body, CFG);
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const publishScore = createAsyncThunk('adminScoring/publish',
    async (body, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/scoring/publish', body, CFG);
            return { data: res.data, status: res.status };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const rollbackScore = createAsyncThunk('adminScoring/rollback',
    async (body, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/scoring/rollback', body, CFG);
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchScoreHistory = createAsyncThunk('adminScoring/history',
    async ({ targetType, id }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/scoring/${targetType}/${id}/history`, CFG);
            return res.data?.data ?? [];
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminScoring',
    initialState: { preview: null, history: [], acting: false, lastError: null, lastResult: null },
    reducers: { clearScoringPreview: (s) => { s.preview = null; s.lastResult = null; } },
    extraReducers: (b) => {
        b
            .addCase(previewScore.pending,   (s) => { s.acting = true; })
            .addCase(previewScore.fulfilled, (s, a) => { s.acting = false; s.preview = a.payload; })
            .addCase(previewScore.rejected,  (s, a) => { s.acting = false; s.lastError = a.payload; })
            .addCase(recalcScore.fulfilled,  (s, a) => { s.preview = a.payload; })
            .addCase(publishScore.fulfilled, (s, a) => { s.lastResult = a.payload; })
            .addCase(publishScore.rejected,  (s, a) => { s.lastError = a.payload; })
            .addCase(rollbackScore.fulfilled,(s, a) => { s.lastResult = { data: { data: a.payload } }; })
            .addCase(fetchScoreHistory.fulfilled, (s, a) => { s.history = a.payload; });
    },
});

export const { clearScoringPreview } = slice.actions;
export default slice.reducer;

export const selectScorePreview  = (s) => s.adminScoring.preview;
export const selectScoreHistory  = (s) => s.adminScoring.history;
export const selectScoringActing = (s) => s.adminScoring.acting;
export const selectScoringError  = (s) => s.adminScoring.lastError;
export const selectScoringResult = (s) => s.adminScoring.lastResult;
