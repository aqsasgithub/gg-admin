import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Cost request failed';

export const fetchCostOverview = createAsyncThunk('adminCosts/overview',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/costs/overview', CFG);
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchCostTrend = createAsyncThunk('adminCosts/trend',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/costs/trend', { ...CFG, params });
            return res.data?.data ?? [];
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchCostByCompany = createAsyncThunk('adminCosts/byCompany',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/costs/companies', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchCompanyCost = createAsyncThunk('adminCosts/forCompany',
    async (companyId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/cost`, CFG);
            return { companyId, detail: res.data?.data };
        } catch (e) { return rejectWithValue({ companyId, error: errOf(e) }); }
    });

export const fetchCompanyCostRecords = createAsyncThunk('adminCosts/records',
    async ({ companyId, ...params }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/cost/records`, { ...CFG, params });
            return { companyId, list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue({ companyId, error: errOf(e) }); }
    });

const slice = createSlice({
    name: 'adminCosts',
    initialState: {
        overview: null, trend: [], byCompany: { list: [], meta: null },
        detailsByCompany: {},  // companyId -> { current, history }
        recordsByCompany: {},  // companyId -> { list, meta }
        loading: false,
    },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchCostOverview.pending,   (s) => { s.loading = true; })
            .addCase(fetchCostOverview.fulfilled, (s, a) => { s.loading = false; s.overview = a.payload; })
            .addCase(fetchCostOverview.rejected,  (s, a) => { s.loading = false; toast.error(a.payload); })

            .addCase(fetchCostTrend.fulfilled,    (s, a) => { s.trend = a.payload; })
            .addCase(fetchCostByCompany.fulfilled,(s, a) => { s.byCompany = a.payload; })

            .addCase(fetchCompanyCost.fulfilled,  (s, a) => {
                s.detailsByCompany[a.payload.companyId] = a.payload.detail;
            })
            .addCase(fetchCompanyCostRecords.fulfilled, (s, a) => {
                s.recordsByCompany[a.payload.companyId] = { list: a.payload.list, meta: a.payload.meta };
            });
    },
});

export default slice.reducer;

export const selectCostOverview        = (s) => s.adminCosts.overview;
export const selectCostTrend           = (s) => s.adminCosts.trend;
export const selectCostByCompany       = (s) => s.adminCosts.byCompany;
export const selectCompanyCost         = (s, cid) => s.adminCosts.detailsByCompany[cid] ?? null;
export const selectCompanyCostRecords  = (s, cid) => s.adminCosts.recordsByCompany[cid] ?? { list: [], meta: null };
export const selectCostsLoading        = (s) => s.adminCosts.loading;
