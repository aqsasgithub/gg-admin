import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Privacy operation failed';

export const fetchPrivacyOperations = createAsyncThunk('adminPrivacy/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/privacy', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchPrivacyOperation = createAsyncThunk('adminPrivacy/fetchOne',
    async (operationId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/privacy/${operationId}`, CFG);
            return { id: operationId, detail: res.data?.data };
        } catch (e) { return rejectWithValue({ id: operationId, error: errOf(e) }); }
    });

export const startPrivacyExport = createAsyncThunk('adminPrivacy/export',
    async ({ subjectType, subjectId, legalBasis }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/privacy/export',
                { subject_type: subjectType, subject_id: subjectId, legal_basis: legalBasis }, CFG);
            toast.success('Export prepared');
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const startPrivacyErasure = createAsyncThunk('adminPrivacy/erase',
    async ({ subjectType, subjectId, legalBasis, confirm }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/privacy/erase',
                { subject_type: subjectType, subject_id: subjectId, legal_basis: legalBasis, confirm }, CFG);
            toast.success('Erasure complete');
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminPrivacy',
    initialState: { list: [], meta: null, loading: false, byId: {}, error: null },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchPrivacyOperations.pending,   (s) => { s.loading = true; })
            .addCase(fetchPrivacyOperations.fulfilled, (s, a) => { s.loading = false; s.list = a.payload.list; s.meta = a.payload.meta; })
            .addCase(fetchPrivacyOperations.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })
            .addCase(fetchPrivacyOperation.fulfilled,  (s, a) => { s.byId[a.payload.id] = a.payload.detail; })
            .addCase(startPrivacyExport.fulfilled, (s, a) => { if (a.payload) { s.list = [a.payload, ...s.list]; } })
            .addCase(startPrivacyErasure.fulfilled, (s, a) => { if (a.payload) { s.list = [a.payload, ...s.list]; } });
    },
});

export default slice.reducer;
export const selectPrivacyOperations        = (s) => s.adminPrivacy.list;
export const selectPrivacyOperationsLoading = (s) => s.adminPrivacy.loading;
export const selectPrivacyOperation         = (s, id) => s.adminPrivacy.byId[id] ?? null;
