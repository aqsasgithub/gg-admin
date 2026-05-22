import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Approvals request failed';

export const fetchApprovals = createAsyncThunk('adminApprovals/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/approvals', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

// Drives approve / reject / cancel.
export const decideApproval = createAsyncThunk('adminApprovals/decide',
    async ({ id, action, body = {} }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/approvals/${id}/${action}`, body, CFG);
            return { id, action, data: res.data };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminApprovals',
    initialState: { list: [], meta: null, loading: false, acting: false, lastError: null },
    reducers: { clearApprovalsError: (s) => { s.lastError = null; } },
    extraReducers: (b) => {
        b
            .addCase(fetchApprovals.pending,   (s) => { s.loading = true; })
            .addCase(fetchApprovals.fulfilled, (s, a) => { s.loading = false; s.list = a.payload.list; s.meta = a.payload.meta; })
            .addCase(fetchApprovals.rejected,  (s, a) => { s.loading = false; s.lastError = a.payload; })
            .addCase(decideApproval.pending,   (s) => { s.acting = true; })
            .addCase(decideApproval.fulfilled, (s) => { s.acting = false; })
            .addCase(decideApproval.rejected,  (s, a) => { s.acting = false; s.lastError = a.payload; });
    },
});

export const { clearApprovalsError } = slice.actions;
export default slice.reducer;

export const selectApprovals        = (s) => s.adminApprovals.list;
export const selectApprovalsMeta    = (s) => s.adminApprovals.meta;
export const selectApprovalsLoading = (s) => s.adminApprovals.loading;
export const selectApprovalsActing  = (s) => s.adminApprovals.acting;
export const selectApprovalsError   = (s) => s.adminApprovals.lastError;
