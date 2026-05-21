import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

/**
 * Generic module-data CRUD slice.
 *
 * One slice serves every (module, dataset) combination. State is keyed
 * by `${module}/${dataset}` so the admin portal can navigate between
 * Brand Protection → Dark Web and Brand Protection → Typos without
 * losing the other tab's state, and (later) between modules the same way.
 *
 * Backed by AdminBrandProtectionController (and its future siblings
 * AdminDomainSecurityController etc.). Endpoints:
 *
 *   GET    /admin/modules/{module}                — overview + dataset list
 *   GET    /admin/modules/{module}/{dataset}      — paginated index
 *   GET    /admin/modules/{module}/{dataset}/{id} — single record
 *   POST   /admin/modules/{module}/{dataset}      — create
 *   PATCH  /admin/modules/{module}/{dataset}/{id} — update
 *   DELETE /admin/modules/{module}/{dataset}/{id} — delete
 *
 * Module slugs use kebab-case in the URL ('brand-protection') so the
 * frontend route param matches the backend path segment exactly.
 */

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Module data request failed';
const datasetKey = (module, dataset) => `${module}/${dataset}`;

// ── Thunks ────────────────────────────────────────────────────────────

export const fetchModuleOverview = createAsyncThunk(
    'adminModuleData/fetchOverview',
    async (module, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/modules/${module}`, CFG);
            return { module, data: res.data?.data };
        } catch (e) { return rejectWithValue(errOf(e)); }
    },
);

export const fetchDatasetRecords = createAsyncThunk(
    'adminModuleData/fetchDataset',
    async ({ module, dataset, params = {} }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/modules/${module}/${dataset}`, { ...CFG, params });
            return {
                key:  datasetKey(module, dataset),
                data: res.data?.data ?? [],
                meta: res.data?.meta ?? null,
            };
        } catch (e) { return rejectWithValue(errOf(e)); }
    },
);

export const fetchDatasetRecord = createAsyncThunk(
    'adminModuleData/fetchRecord',
    async ({ module, dataset, id }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/modules/${module}/${dataset}/${id}`, CFG);
            return { key: datasetKey(module, dataset), id, detail: res.data?.data };
        } catch (e) { return rejectWithValue(errOf(e)); }
    },
);

export const createDatasetRecord = createAsyncThunk(
    'adminModuleData/createRecord',
    async ({ module, dataset, payload }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/modules/${module}/${dataset}`, payload, CFG);
            toast.success('Record created');
            return { key: datasetKey(module, dataset), record: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    },
);

export const updateDatasetRecord = createAsyncThunk(
    'adminModuleData/updateRecord',
    async ({ module, dataset, id, payload }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.patch(`/admin/modules/${module}/${dataset}/${id}`, payload, CFG);
            toast.success('Record updated');
            return { key: datasetKey(module, dataset), record: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    },
);

export const deleteDatasetRecord = createAsyncThunk(
    'adminModuleData/deleteRecord',
    async ({ module, dataset, id }, { rejectWithValue }) => {
        try {
            await apiRequest.delete(`/admin/modules/${module}/${dataset}/${id}`, CFG);
            toast.success('Record deleted');
            return { key: datasetKey(module, dataset), id };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    },
);

// ── Slice ─────────────────────────────────────────────────────────────

const slice = createSlice({
    name: 'adminModuleData',
    initialState: {
        // overviews[module] = { module, label, datasets: [{ slug, label, total_records, ... }] }
        overviews: {},
        // datasets[`${module}/${dataset}`] = { list, meta, loading, error, byId }
        datasets:  {},
    },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchModuleOverview.fulfilled, (s, a) => {
                s.overviews[a.payload.module] = a.payload.data;
            })

            .addCase(fetchDatasetRecords.pending, (s, a) => {
                const k = datasetKey(a.meta.arg.module, a.meta.arg.dataset);
                s.datasets[k] ??= { list: [], meta: null, loading: false, error: null, byId: {} };
                s.datasets[k].loading = true;
                s.datasets[k].error   = null;
            })
            .addCase(fetchDatasetRecords.fulfilled, (s, a) => {
                s.datasets[a.payload.key] ??= { byId: {} };
                s.datasets[a.payload.key].loading = false;
                s.datasets[a.payload.key].list    = a.payload.data;
                s.datasets[a.payload.key].meta    = a.payload.meta;
            })
            .addCase(fetchDatasetRecords.rejected, (s, a) => {
                const k = datasetKey(a.meta.arg.module, a.meta.arg.dataset);
                s.datasets[k] ??= { byId: {} };
                s.datasets[k].loading = false;
                s.datasets[k].error   = a.payload;
            })

            .addCase(fetchDatasetRecord.fulfilled, (s, a) => {
                s.datasets[a.payload.key] ??= { byId: {} };
                s.datasets[a.payload.key].byId[a.payload.id] = a.payload.detail;
            })

            .addCase(createDatasetRecord.fulfilled, (s, a) => {
                const bucket = s.datasets[a.payload.key];
                if (bucket?.list && a.payload.record) {
                    bucket.list = [a.payload.record, ...bucket.list];
                    if (bucket.meta) bucket.meta.total = (bucket.meta.total || 0) + 1;
                }
            })

            .addCase(updateDatasetRecord.fulfilled, (s, a) => {
                const bucket = s.datasets[a.payload.key];
                if (!bucket || !a.payload.record) return;
                if (bucket.list) {
                    bucket.list = bucket.list.map((r) =>
                        r.id === a.payload.record.id ? { ...r, ...a.payload.record } : r
                    );
                }
                bucket.byId ??= {};
                bucket.byId[a.payload.record.id] = a.payload.record;
            })

            .addCase(deleteDatasetRecord.fulfilled, (s, a) => {
                const bucket = s.datasets[a.payload.key];
                if (!bucket) return;
                if (bucket.list) bucket.list = bucket.list.filter((r) => r.id !== a.payload.id);
                if (bucket.byId) delete bucket.byId[a.payload.id];
                if (bucket.meta && bucket.meta.total > 0) bucket.meta.total -= 1;
            });
    },
});

export default slice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────

export const selectModuleOverview = (s, module) => s.adminModuleData.overviews[module] ?? null;
export const selectDataset        = (s, module, dataset) => s.adminModuleData.datasets[`${module}/${dataset}`] ?? null;
export const selectDatasetRecord  = (s, module, dataset, id) =>
    s.adminModuleData.datasets[`${module}/${dataset}`]?.byId?.[id] ?? null;
