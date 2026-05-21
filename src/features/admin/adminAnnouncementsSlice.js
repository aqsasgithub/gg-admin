import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Announcement request failed';

export const fetchAnnouncements = createAsyncThunk('adminAnnouncements/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/announcements', { ...CFG, params });
            return res.data?.data ?? [];
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const createAnnouncement = createAsyncThunk('adminAnnouncements/create',
    async (payload, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/announcements', payload, CFG);
            toast.success('Announcement created');
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const updateAnnouncement = createAsyncThunk('adminAnnouncements/update',
    async ({ id, payload }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.put(`/admin/announcements/${id}`, payload, CFG);
            toast.success('Updated');
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const publishAnnouncement = createAsyncThunk('adminAnnouncements/publish',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/announcements/${id}/publish`, {}, CFG);
            toast.success('Published');
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const unpublishAnnouncement = createAsyncThunk('adminAnnouncements/unpublish',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/announcements/${id}/unpublish`, {}, CFG);
            toast.success('Unpublished');
            return res.data?.data;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

export const deleteAnnouncement = createAsyncThunk('adminAnnouncements/delete',
    async (id, { rejectWithValue }) => {
        try {
            await apiRequest.delete(`/admin/announcements/${id}`, CFG);
            toast.success('Deleted');
            return id;
        } catch (e) { toast.error(errOf(e)); return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminAnnouncements',
    initialState: { list: [], loading: false },
    reducers: {},
    extraReducers: (b) => {
        // Redux Toolkit's builder enforces strict order: every addCase()
        // MUST come BEFORE any addMatcher(). Putting an addCase after an
        // addMatcher throws "addCase should only be called before
        // addMatcher" at slice-construction time and crashes the app on
        // boot. Keep all addCase calls in one block, then any matchers.
        const replaceInList = (s, a) => {
            if (a.payload) s.list = s.list.map((r) => r.id === a.payload.id ? a.payload : r);
        };
        b
            .addCase(fetchAnnouncements.pending,   (s) => { s.loading = true; })
            .addCase(fetchAnnouncements.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; })
            .addCase(createAnnouncement.fulfilled, (s, a) => { if (a.payload) s.list.unshift(a.payload); })
            .addCase(deleteAnnouncement.fulfilled, (s, a) => { s.list = s.list.filter((r) => r.id !== a.payload); })
            // Matchers come AFTER every addCase. update/publish/unpublish
            // all return a full row — replace it in the list.
            .addMatcher(
                (action) => [
                    updateAnnouncement.fulfilled.type,
                    publishAnnouncement.fulfilled.type,
                    unpublishAnnouncement.fulfilled.type,
                ].includes(action.type),
                replaceInList,
            );
    },
});

export default slice.reducer;
export const selectAnnouncements        = (s) => s.adminAnnouncements.list;
export const selectAnnouncementsLoading = (s) => s.adminAnnouncements.loading;
