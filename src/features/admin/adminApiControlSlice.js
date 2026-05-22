import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'API control request failed';

export const fetchProviders = createAsyncThunk('adminApiControl/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/api-control/providers', { ...CFG, params });
            return res.data?.data ?? [];
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchProvider = createAsyncThunk('adminApiControl/fetchOne',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/api-control/providers/${id}`, CFG);
            return { id, detail: res.data?.data };
        } catch (e) { return rejectWithValue({ id, error: errOf(e) }); }
    });

export const updateProvider = createAsyncThunk('adminApiControl/update',
    async ({ id, body }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.put(`/admin/api-control/providers/${id}`, body, CFG);
            return { id, data: res.data?.data };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

// Drives enable / disable / probe / test.
export const providerAction = createAsyncThunk('adminApiControl/action',
    async ({ id, action, body = {} }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/api-control/providers/${id}/${action}`, body, CFG);
            return { id, action, data: res.data, status: res.status };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminApiControl',
    initialState: { list: [], byId: {}, loading: false, acting: false, lastError: null },
    reducers: { clearApiControlError: (s) => { s.lastError = null; } },
    extraReducers: (b) => {
        b
            .addCase(fetchProviders.pending,   (s) => { s.loading = true; })
            .addCase(fetchProviders.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; })
            .addCase(fetchProviders.rejected,  (s, a) => { s.loading = false; s.lastError = a.payload; })
            .addCase(fetchProvider.fulfilled,  (s, a) => { s.byId[a.payload.id] = a.payload.detail; })
            .addCase(updateProvider.pending,   (s) => { s.acting = true; })
            .addCase(updateProvider.fulfilled, (s) => { s.acting = false; })
            .addCase(updateProvider.rejected,  (s, a) => { s.acting = false; s.lastError = a.payload; })
            .addCase(providerAction.pending,   (s) => { s.acting = true; })
            .addCase(providerAction.fulfilled, (s) => { s.acting = false; })
            .addCase(providerAction.rejected,  (s, a) => { s.acting = false; s.lastError = a.payload; });
    },
});

export const { clearApiControlError } = slice.actions;
export default slice.reducer;

export const selectProviders        = (s) => s.adminApiControl.list;
export const selectProvidersLoading = (s) => s.adminApiControl.loading;
export const selectProvider         = (s, id) => s.adminApiControl.byId[id] ?? null;
export const selectApiControlActing = (s) => s.adminApiControl.acting;
export const selectApiControlError  = (s) => s.adminApiControl.lastError;
