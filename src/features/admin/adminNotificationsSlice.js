import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Notifications request failed';

export const fetchNotifications = createAsyncThunk('adminNotifications/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/notifications', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchNotificationStats = createAsyncThunk('adminNotifications/stats',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/notifications/stats', { ...CFG, params });
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchNotification = createAsyncThunk('adminNotifications/fetchOne',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/notifications/${id}`, CFG);
            return { id, detail: res.data?.data };
        } catch (e) { return rejectWithValue({ id, error: errOf(e) }); }
    });

const slice = createSlice({
    name: 'adminNotifications',
    initialState: { list: [], meta: null, stats: null, byId: {}, loading: false },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchNotifications.pending,   (s) => { s.loading = true; })
            .addCase(fetchNotifications.fulfilled, (s, a) => { s.loading = false; s.list = a.payload.list; s.meta = a.payload.meta; })
            .addCase(fetchNotifications.rejected,  (s) => { s.loading = false; })

            .addCase(fetchNotificationStats.fulfilled, (s, a) => { s.stats = a.payload; })
            .addCase(fetchNotification.fulfilled, (s, a) => { s.byId[a.payload.id] = a.payload.detail; });
    },
});

export default slice.reducer;

export const selectNotifications         = (s) => s.adminNotifications.list;
export const selectNotificationsMeta     = (s) => s.adminNotifications.meta;
export const selectNotificationsLoading  = (s) => s.adminNotifications.loading;
export const selectNotificationStats     = (s) => s.adminNotifications.stats;
export const selectNotification          = (s, id) => s.adminNotifications.byId[id] ?? null;
