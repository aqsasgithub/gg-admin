import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Issue request failed';

export const fetchIssues = createAsyncThunk('adminIssues/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/issues', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchIssueStats = createAsyncThunk('adminIssues/stats',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/issues/stats', CFG);
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchIssue = createAsyncThunk('adminIssues/fetchOne',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/issues/${id}`, CFG);
            return { id, detail: res.data?.data };
        } catch (e) { return rejectWithValue({ id, error: errOf(e) }); }
    });

export const transitionIssue = createAsyncThunk('adminIssues/transition',
    async ({ id, to, reason }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/issues/${id}/transition`, { to, reason }, CFG);
            toast.success(`Moved to ${to}`);
            return { id, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue({ id, error: errOf(e) }); }
    });

export const assignIssue = createAsyncThunk('adminIssues/assign',
    async ({ id, userId }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/issues/${id}/assign`, { user_id: userId }, CFG);
            toast.success(userId ? 'Assigned' : 'Unassigned');
            return { id, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue({ id, error: errOf(e) }); }
    });

export const bulkCloseIssues = createAsyncThunk('adminIssues/bulkClose',
    async ({ issueIds, reason }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/issues/bulk/close',
                { issue_ids: issueIds, reason }, CFG);
            toast.success(`Closed ${res.data?.data?.closed ?? 0} issues`);
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const bulkReclassifyIssues = createAsyncThunk('adminIssues/bulkReclassify',
    async ({ issueIds, severity, reason }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/issues/bulk/reclassify',
                { issue_ids: issueIds, severity, reason }, CFG);
            toast.success(`Reclassified ${res.data?.data?.updated ?? 0} issues`);
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminIssues',
    initialState: { list: [], meta: null, stats: null, byId: {}, loading: false },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchIssues.pending,   (s) => { s.loading = true; })
            .addCase(fetchIssues.fulfilled, (s, a) => { s.loading = false; s.list = a.payload.list; s.meta = a.payload.meta; })
            .addCase(fetchIssues.rejected,  (s) => { s.loading = false; })

            .addCase(fetchIssueStats.fulfilled, (s, a) => { s.stats = a.payload; })
            .addCase(fetchIssue.fulfilled, (s, a) => { s.byId[a.payload.id] = a.payload.detail; });

        const writeBack = (s, action) => {
            const { id, detail } = action.payload ?? {};
            if (!id || !detail) return;
            s.byId[id] = detail;
            const summary = detail.issue ?? detail;
            const i = s.list.findIndex((r) => r.id === id);
            if (i >= 0) s.list[i] = { ...s.list[i], ...summary };
        };
        [transitionIssue, assignIssue].forEach((thunk) =>
            b.addCase(thunk.fulfilled, writeBack));
    },
});

export default slice.reducer;

export const selectIssues        = (s) => s.adminIssues.list;
export const selectIssuesMeta    = (s) => s.adminIssues.meta;
export const selectIssuesLoading = (s) => s.adminIssues.loading;
export const selectIssueStats    = (s) => s.adminIssues.stats;
export const selectIssue         = (s, id) => s.adminIssues.byId[id] ?? null;
