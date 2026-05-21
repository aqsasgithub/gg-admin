import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

const API_CONFIG = { showSuccessToast: false, showErrorToast: false };
const errorOf = (e) => e?.response?.data?.message || e?.message || 'Audit log request failed';

export const fetchAuditLog = createAsyncThunk(
    'adminAudit/fetchAuditLog',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/audit', { ...API_CONFIG, params });
            return { data: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errorOf(e)); }
    },
);

export const fetchAuditActions = createAsyncThunk(
    'adminAudit/fetchAuditActions',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/audit/actions', API_CONFIG);
            return res.data?.data ?? [];
        } catch (e) { return rejectWithValue(errorOf(e)); }
    },
    { condition: (_, { getState }) => !getState().adminAudit.actions.length }
);

const slice = createSlice({
    name: 'adminAudit',
    initialState: {
        list:     [],
        meta:     null,
        actions:  [],         // distinct action verbs for the filter dropdown
        loading:  false,
        error:    null,
        filters:  {},
    },
    reducers: {
        setAuditFilters: (s, a) => { s.filters = a.payload ?? {}; },
    },
    extraReducers: (b) => {
        b
            .addCase(fetchAuditLog.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(fetchAuditLog.fulfilled, (s, a) => {
                s.loading = false;
                s.list = a.payload.data;
                s.meta = a.payload.meta;
            })
            .addCase(fetchAuditLog.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            .addCase(fetchAuditActions.fulfilled, (s, a) => { s.actions = a.payload; });
    },
});

export const { setAuditFilters } = slice.actions;
export default slice.reducer;

export const selectAuditLog       = (s) => s.adminAudit.list;
export const selectAuditMeta      = (s) => s.adminAudit.meta;
export const selectAuditActions   = (s) => s.adminAudit.actions;
export const selectAuditLoading   = (s) => s.adminAudit.loading;
export const selectAuditFilters   = (s) => s.adminAudit.filters;
