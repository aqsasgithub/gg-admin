import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Flag request failed';

export const fetchFlags = createAsyncThunk('adminFlags/fetch',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/flags', CFG);
            return res.data?.data ?? [];
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const createFlag = createAsyncThunk('adminFlags/create',
    async (payload, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/flags', payload, CFG);
            toast.success('Flag created');
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const updateFlag = createAsyncThunk('adminFlags/update',
    async ({ flagId, payload }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.put(`/admin/flags/${flagId}`, payload, CFG);
            toast.success('Flag updated');
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const deleteFlag = createAsyncThunk('adminFlags/delete',
    async (flagId, { rejectWithValue }) => {
        try {
            await apiRequest.delete(`/admin/flags/${flagId}`, CFG);
            toast.success('Flag deleted');
            return flagId;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const fetchCompanyFlags = createAsyncThunk('adminFlags/forCompany',
    async (companyId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/flags`, CFG);
            return { companyId, list: res.data?.data ?? [] };
        } catch (e) { return rejectWithValue({ companyId, error: errOf(e) }); }
    });

export const overrideCompanyFlag = createAsyncThunk('adminFlags/override',
    async ({ companyId, key, enabled, reason }, { rejectWithValue, dispatch }) => {
        try {
            await apiRequest.post(`/admin/companies/${companyId}/flags/${key}/override`,
                { enabled, reason }, CFG);
            toast.success('Override set');
            dispatch(fetchCompanyFlags(companyId));
            return { companyId, key, enabled };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const clearCompanyFlagOverride = createAsyncThunk('adminFlags/clearOverride',
    async ({ companyId, key }, { rejectWithValue, dispatch }) => {
        try {
            await apiRequest.delete(`/admin/companies/${companyId}/flags/${key}/override`, CFG);
            toast.success('Override removed');
            dispatch(fetchCompanyFlags(companyId));
            return { companyId, key };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminFlags',
    initialState: { list: [], loading: false, byCompany: {} },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchFlags.pending,   (s) => { s.loading = true; })
            .addCase(fetchFlags.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; })
            .addCase(createFlag.fulfilled, (s, a) => { if (a.payload) s.list.push(a.payload); })
            .addCase(updateFlag.fulfilled, (s, a) => {
                if (a.payload) s.list = s.list.map((f) => f.id === a.payload.id ? a.payload : f);
            })
            .addCase(deleteFlag.fulfilled, (s, a) => { s.list = s.list.filter((f) => f.id !== a.payload); })
            .addCase(fetchCompanyFlags.fulfilled, (s, a) => {
                s.byCompany[a.payload.companyId] = a.payload.list;
            });
    },
});

export default slice.reducer;
export const selectFlags         = (s) => s.adminFlags.list;
export const selectFlagsLoading  = (s) => s.adminFlags.loading;
export const selectCompanyFlags  = (s, cid) => s.adminFlags.byCompany[cid] ?? [];
