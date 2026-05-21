import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Incident action failed';

export const fetchIncidentStatus = createAsyncThunk('adminIncident/status',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/incident/status', CFG);
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const forceLogoutAll = createAsyncThunk('adminIncident/forceLogoutAll',
    async (reason, { rejectWithValue, dispatch }) => {
        try {
            await apiRequest.post('/admin/incident/force-logout-all', { reason }, CFG);
            toast.success('Every session invalidated');
            dispatch(fetchIncidentStatus());
            return true;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const endAllImpersonations = createAsyncThunk('adminIncident/endAllImp',
    async (reason, { rejectWithValue, dispatch }) => {
        try {
            const res = await apiRequest.post('/admin/incident/end-all-impersonations', { reason }, CFG);
            toast.success(`Ended ${res.data?.data?.ended_count ?? 0} sessions`);
            dispatch(fetchIncidentStatus());
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const suspendAllCompanies = createAsyncThunk('adminIncident/suspendAll',
    async ({ reason, confirm, excludeCompanyIds }, { rejectWithValue, dispatch }) => {
        try {
            const res = await apiRequest.post('/admin/incident/suspend-all-companies',
                { reason, confirm, exclude_company_ids: excludeCompanyIds }, CFG);
            toast.success(`Suspended ${res.data?.data?.suspended ?? 0} companies`);
            dispatch(fetchIncidentStatus());
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const freezeScans = createAsyncThunk('adminIncident/freeze',
    async (reason, { rejectWithValue, dispatch }) => {
        try {
            await apiRequest.post('/admin/incident/freeze-scans', { reason }, CFG);
            toast.success('Scans frozen platform-wide');
            dispatch(fetchIncidentStatus());
            return true;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const unfreezeScans = createAsyncThunk('adminIncident/unfreeze',
    async (_, { rejectWithValue, dispatch }) => {
        try {
            await apiRequest.post('/admin/incident/unfreeze-scans', {}, CFG);
            toast.success('Scans resumed');
            dispatch(fetchIncidentStatus());
            return true;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminIncident',
    initialState: { status: null, loading: false },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchIncidentStatus.pending,   (s) => { s.loading = true; })
            .addCase(fetchIncidentStatus.fulfilled, (s, a) => { s.loading = false; s.status = a.payload; });
    },
});

export default slice.reducer;
export const selectIncidentStatus = (s) => s.adminIncident.status;
export const selectIncidentLoading = (s) => s.adminIncident.loading;
