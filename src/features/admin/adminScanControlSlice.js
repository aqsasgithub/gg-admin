import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Scan control request failed';

// ── Per-tenant scan control ──────────────────────────────────────────────

export const fetchScanControl = createAsyncThunk('adminScanControl/show',
    async (companyId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/scan-control`, CFG);
            return { companyId, detail: res.data?.data };
        } catch (e) { return rejectWithValue({ companyId, error: errOf(e) }); }
    });

export const updateScanControl = createAsyncThunk('adminScanControl/update',
    async ({ companyId, payload }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.put(`/admin/companies/${companyId}/scan-control`, payload, CFG);
            toast.success('Scan control updated');
            return { companyId, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const freezeTenantScans = createAsyncThunk('adminScanControl/freeze',
    async ({ companyId, reason }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/companies/${companyId}/scan-control/freeze`, { reason }, CFG);
            toast.success('Tenant scans frozen');
            return { companyId, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const unfreezeTenantScans = createAsyncThunk('adminScanControl/unfreeze',
    async ({ companyId }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/companies/${companyId}/scan-control/unfreeze`, {}, CFG);
            toast.success('Tenant scans unfrozen');
            return { companyId, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const blockModule = createAsyncThunk('adminScanControl/blockModule',
    async ({ companyId, module, reason }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(
                `/admin/companies/${companyId}/scan-control/block-module`,
                { module, reason }, CFG);
            toast.success(`Blocked '${module}'`);
            return { companyId, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const unblockModule = createAsyncThunk('adminScanControl/unblockModule',
    async ({ companyId, module }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(
                `/admin/companies/${companyId}/scan-control/unblock-module`,
                { module }, CFG);
            toast.success(`Unblocked '${module}'`);
            return { companyId, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

// ── Stuck scans + force-fail ─────────────────────────────────────────────

export const fetchStuckScans = createAsyncThunk('adminScanControl/stuck',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/scans/stuck', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const markScanFailed = createAsyncThunk('adminScanControl/markFailed',
    async ({ scanId, reason }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/scans/${scanId}/mark-failed`, { reason }, CFG);
            toast.success('Scan force-failed');
            return { scanId, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminScanControl',
    initialState: {
        byCompany: {},              // companyId -> { company, control, live, available_modules }
        stuck: { list: [], meta: null },
        loading: false,
    },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchScanControl.fulfilled, (s, a) => {
                s.byCompany[a.payload.companyId] = a.payload.detail;
            });

        // All mutations return the full re-rendered detail
        const writeBack = (s, action) => {
            const { companyId, detail } = action.payload ?? {};
            if (!companyId || !detail) return;
            s.byCompany[companyId] = detail;
        };
        [updateScanControl, freezeTenantScans, unfreezeTenantScans, blockModule, unblockModule]
            .forEach((thunk) => b.addCase(thunk.fulfilled, writeBack));

        b
            .addCase(fetchStuckScans.pending,    (s) => { s.loading = true; })
            .addCase(fetchStuckScans.fulfilled,  (s, a) => { s.loading = false; s.stuck = a.payload; })
            .addCase(fetchStuckScans.rejected,   (s) => { s.loading = false; })

            .addCase(markScanFailed.fulfilled, (s, a) => {
                s.stuck.list = s.stuck.list.filter((r) => r.id !== a.payload.scanId);
            });
    },
});

export default slice.reducer;

export const selectScanControl = (s, cid) => s.adminScanControl.byCompany[cid] ?? null;
export const selectStuckScans  = (s) => s.adminScanControl.stuck.list;
export const selectStuckScansMeta = (s) => s.adminScanControl.stuck.meta;
export const selectScanControlLoading = (s) => s.adminScanControl.loading;
