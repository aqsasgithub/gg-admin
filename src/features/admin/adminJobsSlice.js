import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Job request failed';

export const fetchJobSummary = createAsyncThunk('adminJobs/summary',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/jobs', CFG);
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchFailedJobs = createAsyncThunk('adminJobs/failed',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/jobs/failed', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchFailedJob = createAsyncThunk('adminJobs/failedOne',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/jobs/failed/${id}`, CFG);
            return { id, detail: res.data?.data };
        } catch (e) { return rejectWithValue({ id, error: errOf(e) }); }
    });

export const retryFailedJob = createAsyncThunk('adminJobs/retry',
    async (id, { rejectWithValue }) => {
        try {
            await apiRequest.post(`/admin/jobs/failed/${id}/retry`, {}, CFG);
            toast.success('Retry queued');
            return id;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const forgetFailedJob = createAsyncThunk('adminJobs/forget',
    async (id, { rejectWithValue }) => {
        try {
            await apiRequest.post(`/admin/jobs/failed/${id}/forget`, {}, CFG);
            toast.success('Job removed');
            return id;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const retryAllFailedJobs = createAsyncThunk('adminJobs/retryAll',
    async (queue, { rejectWithValue }) => {
        try {
            await apiRequest.post('/admin/jobs/failed/retry-all', { queue }, CFG);
            toast.success(`Retried all failed jobs on ${queue ?? 'default'}`);
            return true;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminJobs',
    initialState: { summary: null, failedList: [], failedMeta: null, byId: {}, loading: false },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchJobSummary.fulfilled, (s, a) => { s.summary = a.payload; })
            .addCase(fetchFailedJobs.pending,   (s) => { s.loading = true; })
            .addCase(fetchFailedJobs.fulfilled, (s, a) => { s.loading = false; s.failedList = a.payload.list; s.failedMeta = a.payload.meta; })
            .addCase(fetchFailedJob.fulfilled,  (s, a) => { s.byId[a.payload.id] = a.payload.detail; })
            .addCase(retryFailedJob.fulfilled,  (s, a) => { s.failedList = s.failedList.filter((j) => String(j.id) !== String(a.payload)); })
            .addCase(forgetFailedJob.fulfilled, (s, a) => { s.failedList = s.failedList.filter((j) => String(j.id) !== String(a.payload)); });
    },
});

export default slice.reducer;
export const selectJobSummary    = (s) => s.adminJobs.summary;
export const selectFailedJobs    = (s) => s.adminJobs.failedList;
export const selectFailedJobsMeta = (s) => s.adminJobs.failedMeta;
export const selectFailedJob     = (s, id) => s.adminJobs.byId[id] ?? null;
export const selectJobsLoading   = (s) => s.adminJobs.loading;
