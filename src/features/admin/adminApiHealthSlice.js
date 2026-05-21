import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

/**
 * adminApiHealthSlice — feeds the API monitor page.
 *
 * The index endpoint returns a summary + full probe list; we cache it in
 * full. Per-probe history is fetched on demand and keyed by service_key.
 */

const API_CONFIG = { showSuccessToast: false, showErrorToast: false };
const errorOf = (e) => e?.response?.data?.message || e?.message || 'API health request failed';

export const fetchApiHealth = createAsyncThunk(
    'adminApiHealth/fetchApiHealth',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/apihealth', { ...API_CONFIG, params });
            return res.data?.data;
        } catch (e) { return rejectWithValue(errorOf(e)); }
    },
);

export const fetchApiHealthDetail = createAsyncThunk(
    'adminApiHealth/fetchApiHealthDetail',
    async (serviceKey, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/apihealth/${serviceKey}`, API_CONFIG);
            return { serviceKey, data: res.data?.data };
        } catch (e) { return rejectWithValue({ serviceKey, error: errorOf(e) }); }
    },
);

export const forceProbe = createAsyncThunk(
    'adminApiHealth/forceProbe',
    async (serviceKey, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/apihealth/${serviceKey}/probe`, {}, API_CONFIG);
            const result = res.data?.data;
            toast.success(`${serviceKey}: ${result?.status ?? 'probed'}`);
            return { serviceKey, result };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ serviceKey, error: errorOf(e) });
        }
    },
);

export const setAlertingEnabled = createAsyncThunk(
    'adminApiHealth/setAlertingEnabled',
    async ({ serviceKey, enabled }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.put(`/admin/apihealth/${serviceKey}/silence`, {
                alerting_enabled: enabled,
            }, API_CONFIG);
            return { serviceKey, data: res.data?.data };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue({ serviceKey, error: errorOf(e) });
        }
    },
);

const initial = {
    summary:       null,
    probes:        [],
    detailByKey:   {},
    loading:       false,
    probingKeys:   {},          // forced-probes in flight
    error:         null,
    lastFetchedAt: null,
};

const slice = createSlice({
    name: 'adminApiHealth',
    initialState: initial,
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchApiHealth.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(fetchApiHealth.fulfilled, (s, a) => {
                s.loading = false;
                s.summary = a.payload?.summary ?? null;
                s.probes  = a.payload?.probes  ?? [];
                s.lastFetchedAt = new Date().toISOString();
            })
            .addCase(fetchApiHealth.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            .addCase(fetchApiHealthDetail.fulfilled, (s, a) => {
                s.detailByKey[a.payload.serviceKey] = a.payload.data;
            })

            .addCase(forceProbe.pending,   (s, a) => { s.probingKeys[a.meta.arg] = true; })
            .addCase(forceProbe.fulfilled, (s, a) => {
                delete s.probingKeys[a.payload.serviceKey];
                // Patch the matching probe row with the new snapshot fields.
                const idx = s.probes.findIndex((p) => p.service_key === a.payload.serviceKey);
                if (idx !== -1 && a.payload.result) {
                    s.probes[idx] = { ...s.probes[idx], ...a.payload.result };
                }
            })
            .addCase(forceProbe.rejected,  (s, a) => { delete s.probingKeys[a.meta.arg]; })

            .addCase(setAlertingEnabled.fulfilled, (s, a) => {
                const idx = s.probes.findIndex((p) => p.service_key === a.payload.serviceKey);
                if (idx !== -1) s.probes[idx] = { ...s.probes[idx], ...a.payload.data };
            });
    },
});

export default slice.reducer;

export const selectApiHealthSummary  = (s) => s.adminApiHealth.summary;
export const selectApiHealthProbes   = (s) => s.adminApiHealth.probes;
export const selectApiHealthLoading  = (s) => s.adminApiHealth.loading;
export const selectApiHealthDetail   = (s, key) => s.adminApiHealth.detailByKey[key] ?? null;
export const selectIsProbing         = (s, key) => !!s.adminApiHealth.probingKeys[key];
export const selectLastFetchedAt     = (s) => s.adminApiHealth.lastFetchedAt;
