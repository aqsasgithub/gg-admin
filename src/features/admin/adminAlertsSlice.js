import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Alert request failed';

export const fetchAlerts = createAsyncThunk('adminAlerts/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/alerts', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchCompanyAlerts = createAsyncThunk('adminAlerts/fetchForCompany',
    async ({ companyId, ...params }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/alerts`, { ...CFG, params });
            return { companyId, list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue({ companyId, error: errOf(e) }); }
    });

export const fetchAlertStats = createAsyncThunk('adminAlerts/stats',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/alerts/stats', CFG);
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchAlert = createAsyncThunk('adminAlerts/fetchOne',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/alerts/${id}`, CFG);
            return { id, detail: res.data?.data };
        } catch (e) { return rejectWithValue({ id, error: errOf(e) }); }
    });

export const transitionAlert = createAsyncThunk('adminAlerts/transition',
    async ({ id, to, reason, note }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/alerts/${id}/transition`, { to, reason, note }, CFG);
            toast.success(`Moved to ${to}`);
            return { id, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue({ id, error: errOf(e) }); }
    });

export const assignAlert = createAsyncThunk('adminAlerts/assign',
    async ({ id, userId, team }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/alerts/${id}/assign`, { user_id: userId, team }, CFG);
            toast.success(userId || team ? 'Assigned' : 'Unassigned');
            return { id, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue({ id, error: errOf(e) }); }
    });

export const addAlertNote = createAsyncThunk('adminAlerts/note',
    async ({ id, note }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/alerts/${id}/notes`, { note }, CFG);
            toast.success('Note added');
            return { id, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue({ id, error: errOf(e) }); }
    });

export const bulkTransitionAlerts = createAsyncThunk('adminAlerts/bulkTransition',
    async ({ alertIds, to, reason }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/alerts/bulk/transition',
                { alert_ids: alertIds, to, reason }, CFG);
            toast.success(`Transitioned ${res.data?.data?.transitioned ?? 0} alerts`);
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const bulkAssignAlerts = createAsyncThunk('adminAlerts/bulkAssign',
    async ({ alertIds, userId, team }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/alerts/bulk/assign',
                { alert_ids: alertIds, user_id: userId, team }, CFG);
            toast.success(`Assigned ${res.data?.data?.assigned ?? 0} alerts`);
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminAlerts',
    initialState: {
        list: [], meta: null, stats: null, byId: {},
        byCompany: {},
        loading: false,
    },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchAlerts.pending,   (s) => { s.loading = true; })
            .addCase(fetchAlerts.fulfilled, (s, a) => { s.loading = false; s.list = a.payload.list; s.meta = a.payload.meta; })
            .addCase(fetchAlerts.rejected,  (s) => { s.loading = false; })

            .addCase(fetchCompanyAlerts.fulfilled, (s, a) => {
                s.byCompany[a.payload.companyId] = { list: a.payload.list, meta: a.payload.meta };
            })

            .addCase(fetchAlertStats.fulfilled, (s, a) => { s.stats = a.payload; })
            .addCase(fetchAlert.fulfilled, (s, a) => { s.byId[a.payload.id] = a.payload.detail; });

        const writeBack = (s, action) => {
            const { id, detail } = action.payload ?? {};
            if (!id || !detail) return;
            s.byId[id] = detail;
            const summary = detail.alert ?? detail;
            const i = s.list.findIndex((r) => r.id === id);
            if (i >= 0) s.list[i] = { ...s.list[i], ...summary };
        };
        [transitionAlert, assignAlert, addAlertNote].forEach((thunk) =>
            b.addCase(thunk.fulfilled, writeBack));
    },
});

export default slice.reducer;

export const selectAlerts             = (s) => s.adminAlerts.list;
export const selectAlertsMeta         = (s) => s.adminAlerts.meta;
export const selectAlertsLoading      = (s) => s.adminAlerts.loading;
export const selectAlertStats         = (s) => s.adminAlerts.stats;
export const selectAlert              = (s, id) => s.adminAlerts.byId[id] ?? null;
export const selectCompanyAlerts      = (s, cid) => s.adminAlerts.byCompany[cid]?.list ?? [];
export const selectCompanyAlertsLoading = () => false;
