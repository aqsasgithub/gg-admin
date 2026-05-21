import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Integration request failed';

export const fetchIntegrations = createAsyncThunk('adminIntegrations/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/integrations', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchCompanyIntegrations = createAsyncThunk('adminIntegrations/fetchForCompany',
    async (companyId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/integrations`, CFG);
            return { companyId, list: res.data?.data ?? [] };
        } catch (e) { return rejectWithValue({ companyId, error: errOf(e) }); }
    });

export const fetchIntegrationStats = createAsyncThunk('adminIntegrations/stats',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/integrations/stats', CFG);
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchIntegration = createAsyncThunk('adminIntegrations/fetchOne',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/integrations/${id}`, CFG);
            return { id, detail: res.data?.data };
        } catch (e) { return rejectWithValue({ id, error: errOf(e) }); }
    });

export const enableIntegration = createAsyncThunk('adminIntegrations/enable',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/integrations/${id}/enable`, {}, CFG);
            toast.success('Enabled');
            return { id, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const disableIntegration = createAsyncThunk('adminIntegrations/disable',
    async ({ id, reason }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/integrations/${id}/disable`, { reason }, CFG);
            toast.success('Disabled');
            return { id, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const disconnectIntegration = createAsyncThunk('adminIntegrations/disconnect',
    async ({ id, reason }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/integrations/${id}/disconnect`, { reason }, CFG);
            toast.success('Force-disconnected');
            return { id, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminIntegrations',
    initialState: {
        list: [], meta: null, stats: null, byId: {}, byCompany: {},
        loading: false,
    },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchIntegrations.pending,   (s) => { s.loading = true; })
            .addCase(fetchIntegrations.fulfilled, (s, a) => { s.loading = false; s.list = a.payload.list; s.meta = a.payload.meta; })
            .addCase(fetchIntegrations.rejected,  (s) => { s.loading = false; })

            .addCase(fetchCompanyIntegrations.fulfilled, (s, a) => {
                s.byCompany[a.payload.companyId] = a.payload.list;
            })

            .addCase(fetchIntegrationStats.fulfilled, (s, a) => { s.stats = a.payload; })
            .addCase(fetchIntegration.fulfilled, (s, a) => { s.byId[a.payload.id] = a.payload.detail; });

        const writeBack = (s, action) => {
            const { id, detail } = action.payload ?? {};
            if (!id || !detail) return;
            s.byId[id] = detail;
            const i = s.list.findIndex((r) => r.id === id);
            if (i >= 0) s.list[i] = { ...s.list[i], ...detail };
            Object.values(s.byCompany).forEach((bucket) => {
                const j = bucket?.findIndex?.((r) => r.id === id);
                if (j >= 0) bucket[j] = { ...bucket[j], ...detail };
            });
        };
        [enableIntegration, disableIntegration, disconnectIntegration].forEach((thunk) =>
            b.addCase(thunk.fulfilled, writeBack));
    },
});

export default slice.reducer;

export const selectIntegrations         = (s) => s.adminIntegrations.list;
export const selectIntegrationsMeta     = (s) => s.adminIntegrations.meta;
export const selectIntegrationsLoading  = (s) => s.adminIntegrations.loading;
export const selectIntegrationsStats    = (s) => s.adminIntegrations.stats;
export const selectIntegration          = (s, id) => s.adminIntegrations.byId[id] ?? null;
export const selectCompanyIntegrations  = (s, cid) => s.adminIntegrations.byCompany[cid] ?? [];
