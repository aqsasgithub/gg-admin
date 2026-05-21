import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Pricing request failed';

// ── Plans ────────────────────────────────────────────────────────────
export const fetchPricingPlans = createAsyncThunk('adminPricing/plans',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/pricing/plans', CFG);
            return res.data?.data ?? [];
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const createPricingPlan = createAsyncThunk('adminPricing/createPlan',
    async (payload, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/pricing/plans', payload, CFG);
            toast.success(`Plan ${payload.name} created`);
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const updatePricingPlan = createAsyncThunk('adminPricing/updatePlan',
    async ({ id, payload }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.put(`/admin/pricing/plans/${id}`, payload, CFG);
            toast.success('Plan updated');
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const deletePricingPlan = createAsyncThunk('adminPricing/deletePlan',
    async (id, { rejectWithValue }) => {
        try {
            await apiRequest.delete(`/admin/pricing/plans/${id}`, CFG);
            toast.success('Plan deleted');
            return { id };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

// ── Module pricing ───────────────────────────────────────────────────
export const fetchModulePricing = createAsyncThunk('adminPricing/modules',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/pricing/modules', CFG);
            return res.data?.data ?? [];
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const updateModulePricing = createAsyncThunk('adminPricing/updateModule',
    async ({ id, payload }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.put(`/admin/pricing/modules/${id}`, payload, CFG);
            toast.success('Module pricing updated');
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

// ── Per-company ──────────────────────────────────────────────────────
export const fetchCompanyPricing = createAsyncThunk('adminPricing/forCompany',
    async (companyId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/pricing`, CFG);
            return { companyId, detail: res.data?.data };
        } catch (e) { return rejectWithValue({ companyId, error: errOf(e) }); }
    });

export const assignCompanyPricing = createAsyncThunk('adminPricing/assign',
    async ({ companyId, payload }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/companies/${companyId}/pricing`, payload, CFG);
            toast.success('Pricing assigned');
            return { companyId, current: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const previewCompanyCost = createAsyncThunk('adminPricing/preview',
    async ({ companyId, payload = {} }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/companies/${companyId}/pricing/preview`, payload, CFG);
            return { companyId, preview: res.data?.data };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminPricing',
    initialState: {
        plans: [], modules: [],
        byCompany: {},   // companyId -> { current, effective_settings, history }
        previews:  {},   // companyId -> preview result
        loading:   false,
    },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchPricingPlans.pending,   (s) => { s.loading = true; })
            .addCase(fetchPricingPlans.fulfilled, (s, a) => { s.loading = false; s.plans = a.payload; })
            .addCase(fetchPricingPlans.rejected,  (s) => { s.loading = false; })

            .addCase(createPricingPlan.fulfilled, (s, a) => { s.plans.unshift(a.payload); })
            .addCase(updatePricingPlan.fulfilled, (s, a) => {
                const i = s.plans.findIndex((p) => p.id === a.payload.id);
                if (i >= 0) s.plans[i] = a.payload;
            })
            .addCase(deletePricingPlan.fulfilled, (s, a) => {
                s.plans = s.plans.filter((p) => p.id !== a.payload.id);
            })

            .addCase(fetchModulePricing.fulfilled, (s, a) => { s.modules = a.payload; })
            .addCase(updateModulePricing.fulfilled, (s, a) => {
                const i = s.modules.findIndex((m) => m.id === a.payload.id);
                if (i >= 0) s.modules[i] = a.payload;
            })

            .addCase(fetchCompanyPricing.fulfilled, (s, a) => {
                s.byCompany[a.payload.companyId] = a.payload.detail;
            })
            .addCase(assignCompanyPricing.fulfilled, (s, a) => {
                if (s.byCompany[a.payload.companyId]) {
                    s.byCompany[a.payload.companyId].current = a.payload.current;
                }
            })
            .addCase(previewCompanyCost.fulfilled, (s, a) => {
                s.previews[a.payload.companyId] = a.payload.preview;
            });
    },
});

export default slice.reducer;

export const selectPricingPlans    = (s) => s.adminPricing.plans;
export const selectModulePricing   = (s) => s.adminPricing.modules;
export const selectCompanyPricing  = (s, cid) => s.adminPricing.byCompany[cid] ?? null;
export const selectCostPreview     = (s, cid) => s.adminPricing.previews[cid] ?? null;
export const selectPricingLoading  = (s) => s.adminPricing.loading;
