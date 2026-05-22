import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Scan control request failed';

export const fetchScanControl = createAsyncThunk('scanControlOps/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/scan-control', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const runScan = createAsyncThunk('scanControlOps/run',
    async (body, { rejectWithValue }) => {
        try { const res = await apiRequest.post('/admin/scan-control/run', body, CFG); return res.data; }
        catch (e) { return rejectWithValue(errOf(e)); }
    });

// retry/replay/reprocess/cancel/priority/archive
export const scanControlAction = createAsyncThunk('scanControlOps/action',
    async ({ scanId, action, body = {} }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/scan-control/${scanId}/${action}`, body, CFG);
            return { data: res.data, status: res.status };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminScanControlOps',
    initialState: { list: [], meta: null, loading: false, acting: false, lastError: null },
    reducers: { clearScanControlError: (s) => { s.lastError = null; } },
    extraReducers: (b) => {
        b.addCase(fetchScanControl.pending, (s) => { s.loading = true; })
         .addCase(fetchScanControl.fulfilled, (s, a) => { s.loading = false; s.list = a.payload.list; s.meta = a.payload.meta; })
         .addCase(fetchScanControl.rejected, (s, a) => { s.loading = false; s.lastError = a.payload; })
         .addCase(runScan.fulfilled, (s) => { s.acting = false; })
         .addCase(scanControlAction.pending, (s) => { s.acting = true; })
         .addCase(scanControlAction.fulfilled, (s) => { s.acting = false; })
         .addCase(scanControlAction.rejected, (s, a) => { s.acting = false; s.lastError = a.payload; });
    },
});
export const { clearScanControlError } = slice.actions;
export default slice.reducer;
export const selectScanControlList = (s) => s.adminScanControlOps.list;
export const selectScanControlMeta = (s) => s.adminScanControlOps.meta;
export const selectScanControlLoading = (s) => s.adminScanControlOps.loading;
export const selectScanControlActing = (s) => s.adminScanControlOps.acting;
