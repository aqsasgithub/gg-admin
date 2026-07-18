// Operator notification center — admin portal slice ("my bell").
//
// Distinct from adminNotificationsSlice, which reads the cross-tenant DELIVERY
// LOG (/admin/notifications — what the platform sent to third-party tools).
// This slice powers the operator's OWN bell, backed by /admin/me/notifications
// (audience='admin' rows only — never tenant data).
//
// Real-time readiness mirrors the client slice: an `ingest` reducer lets a
// future WS/Echo transport fold a pushed notification into state.
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const unwrap = (res) => res.data?.data ?? res.data;

export const fetchMyNotifications = createAsyncThunk(
    'meNotifications/fetch',
    async ({ page = 1, perPage = 20, category, severity, unread } = {}, { rejectWithValue }) => {
        try {
            const params = { page, per_page: perPage };
            if (category) params.category = category;
            if (severity) params.severity = severity;
            if (unread) params.unread = 1;
            const res = await apiRequest.get('/admin/me/notifications', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null, page };
        } catch (e) { return rejectWithValue(e?.response?.data?.message || e.message); }
    }
);

export const fetchMyUnreadCount = createAsyncThunk(
    'meNotifications/unreadCount',
    async (_, { rejectWithValue }) => {
        try {
            const data = unwrap(await apiRequest.get('/admin/me/notifications/unread-count', CFG));
            return data?.unread ?? 0;
        } catch (e) { return rejectWithValue(e?.response?.data?.message || e.message); }
    }
);

export const markMyNotificationRead = createAsyncThunk(
    'meNotifications/markRead',
    async (id, { rejectWithValue }) => {
        try {
            await apiRequest.post(`/admin/me/notifications/${id}/read`, {}, CFG);
            return id;
        } catch (e) { return rejectWithValue(e?.response?.data?.message || e.message); }
    }
);

export const markAllMyNotificationsRead = createAsyncThunk(
    'meNotifications/markAllRead',
    async (_, { rejectWithValue }) => {
        try {
            await apiRequest.post('/admin/me/notifications/read-all', {}, CFG);
            return true;
        } catch (e) { return rejectWithValue(e?.response?.data?.message || e.message); }
    }
);

const initialState = { items: [], meta: null, unread: 0, loading: false, error: null };

const mergeItems = (existing, incoming) => {
    const map = new Map();
    [...incoming, ...existing].forEach((n) => { if (n && n.id) map.set(n.id, n); });
    return Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
};

const slice = createSlice({
    name: 'meNotifications',
    initialState,
    reducers: {
        ingest(state, action) {
            const n = action.payload;
            if (!n || !n.id) return;
            const isNew = !state.items.some((x) => x.id === n.id);
            state.items = mergeItems(state.items, [n]);
            if (isNew && !n.read) state.unread += 1;
        },
        resetMyNotifications() { return initialState; },
    },
    extraReducers: (b) => {
        b
            .addCase(fetchMyNotifications.pending, (s) => { s.loading = true; s.error = null; })
            .addCase(fetchMyNotifications.fulfilled, (s, a) => {
                s.loading = false;
                s.meta = a.payload.meta;
                s.items = a.payload.page > 1 ? mergeItems(s.items, a.payload.list) : a.payload.list;
            })
            .addCase(fetchMyNotifications.rejected, (s, a) => { s.loading = false; s.error = a.payload; })
            .addCase(fetchMyUnreadCount.fulfilled, (s, a) => { s.unread = a.payload; })
            .addCase(markMyNotificationRead.fulfilled, (s, a) => {
                const n = s.items.find((x) => x.id === a.payload);
                if (n && !n.read) { n.read = true; s.unread = Math.max(0, s.unread - 1); }
            })
            .addCase(markAllMyNotificationsRead.fulfilled, (s) => {
                s.items.forEach((n) => { n.read = true; });
                s.unread = 0;
            });
    },
});

export const { ingest, resetMyNotifications } = slice.actions;

export const selectMyNotifications = (state) => state.meNotifications.items;
export const selectMyUnreadCount = (state) => state.meNotifications.unread;
export const selectMyNotificationsLoading = (state) => state.meNotifications.loading;
export const selectMyNotificationsMeta = (state) => state.meNotifications.meta;

export default slice.reducer;
