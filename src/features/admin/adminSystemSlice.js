import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'System health fetch failed';

export const fetchSystemSnapshot = createAsyncThunk('adminSystem/snapshot',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/system', CFG);
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchSlowQueries = createAsyncThunk('adminSystem/slowQueries',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/system/db', CFG);
            return res.data?.data ?? [];
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminSystem',
    initialState: { snapshot: null, slowQueries: [], loading: false, error: null },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchSystemSnapshot.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(fetchSystemSnapshot.fulfilled, (s, a) => { s.loading = false; s.snapshot = a.payload; })
            .addCase(fetchSystemSnapshot.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })
            .addCase(fetchSlowQueries.fulfilled,    (s, a) => { s.slowQueries = a.payload; });
    },
});

export default slice.reducer;
export const selectSystemSnapshot = (s) => s.adminSystem.snapshot;
export const selectSystemLoading  = (s) => s.adminSystem.loading;
export const selectSlowQueries    = (s) => s.adminSystem.slowQueries;
