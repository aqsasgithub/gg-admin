import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Scan request failed';

export const fetchScans = createAsyncThunk('adminScans/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/scans', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchCompanyScans = createAsyncThunk('adminScans/fetchForCompany',
    async ({ companyId, ...params }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/scans`, { ...CFG, params });
            return { companyId, list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue({ companyId, error: errOf(e) }); }
    });

export const fetchScanStats = createAsyncThunk('adminScans/stats',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/scans/stats', { ...CFG, params });
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchScan = createAsyncThunk('adminScans/fetchOne',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/scans/${id}`, CFG);
            return { id, detail: res.data?.data };
        } catch (e) { return rejectWithValue({ id, error: errOf(e) }); }
    });

const slice = createSlice({
    name: 'adminScans',
    initialState: { list: [], meta: null, stats: null, byId: {}, byCompany: {}, loading: false },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchScans.pending,   (s) => { s.loading = true; })
            .addCase(fetchScans.fulfilled, (s, a) => { s.loading = false; s.list = a.payload.list; s.meta = a.payload.meta; })
            .addCase(fetchScans.rejected,  (s) => { s.loading = false; })

            .addCase(fetchCompanyScans.fulfilled, (s, a) => {
                s.byCompany[a.payload.companyId] = { list: a.payload.list, meta: a.payload.meta };
            })
            .addCase(fetchScanStats.fulfilled, (s, a) => { s.stats = a.payload; })
            .addCase(fetchScan.fulfilled, (s, a) => { s.byId[a.payload.id] = a.payload.detail; });
    },
});

export default slice.reducer;

export const selectScans        = (s) => s.adminScans.list;
export const selectScansMeta    = (s) => s.adminScans.meta;
export const selectScansLoading = (s) => s.adminScans.loading;
export const selectScanStats    = (s) => s.adminScans.stats;
export const selectScan         = (s, id) => s.adminScans.byId[id] ?? null;
export const selectCompanyScans = (s, cid) => s.adminScans.byCompany[cid]?.list ?? [];
export const selectCompanyScansLoading = () => false;
