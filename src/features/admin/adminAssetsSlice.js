import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Asset request failed';

export const fetchAssets = createAsyncThunk('adminAssets/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/assets', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchCompanyAssets = createAsyncThunk('adminAssets/fetchForCompany',
    async ({ companyId, ...params }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/assets`, { ...CFG, params });
            return { companyId, list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue({ companyId, error: errOf(e) }); }
    });

export const fetchAssetStats = createAsyncThunk('adminAssets/stats',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/assets/stats', CFG);
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminAssets',
    initialState: { list: [], meta: null, stats: null, byCompany: {}, loading: false },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchAssets.pending,   (s) => { s.loading = true; })
            .addCase(fetchAssets.fulfilled, (s, a) => { s.loading = false; s.list = a.payload.list; s.meta = a.payload.meta; })
            .addCase(fetchAssets.rejected,  (s) => { s.loading = false; })

            .addCase(fetchCompanyAssets.fulfilled, (s, a) => {
                s.byCompany[a.payload.companyId] = { list: a.payload.list, meta: a.payload.meta };
            })
            .addCase(fetchAssetStats.fulfilled, (s, a) => { s.stats = a.payload; });
    },
});

export default slice.reducer;

export const selectAssets        = (s) => s.adminAssets.list;
export const selectAssetsMeta    = (s) => s.adminAssets.meta;
export const selectAssetsLoading = (s) => s.adminAssets.loading;
export const selectAssetStats    = (s) => s.adminAssets.stats;
export const selectCompanyAssets = (s, cid) => s.adminAssets.byCompany[cid]?.list ?? [];
