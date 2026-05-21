import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

/**
 * Admin Login History slice — reads /api/admin/login-history (platform-wide)
 * and /api/admin/users/{user}/login-history (per-user).
 *
 * Backed by AdminLoginHistoryController on the server. The capability
 * gate is `users.read` so any admin who can see the Users page can also
 * see login history.
 *
 * Filters supported by the backend (passed straight through as query params):
 *   from / to    ISO timestamps
 *   method       password / impersonation / 2fa / token_refresh
 *   success      true / false
 *   ip           LIKE-match substring
 *   per_page     1..200, default 50
 */

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Login history request failed';

export const fetchLoginHistory = createAsyncThunk(
    'adminLoginHistory/fetchPlatform',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/login-history', { ...CFG, params });
            return { data: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    },
);

export const fetchUserLoginHistory = createAsyncThunk(
    'adminLoginHistory/fetchForUser',
    async ({ userId, params = {} }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/users/${userId}/login-history`, { ...CFG, params });
            return {
                userId,
                user:    res.data?.data?.user ?? null,
                history: res.data?.data?.history ?? [],
                meta:    res.data?.meta ?? null,
            };
        } catch (e) { return rejectWithValue(errOf(e)); }
    },
);

const slice = createSlice({
    name: 'adminLoginHistory',
    initialState: {
        list:    [],
        meta:    null,
        loading: false,
        error:   null,
        // Per-user data is keyed so the admin can flip between users
        // without thrashing the platform-wide list.
        byUser:  {},
    },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchLoginHistory.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(fetchLoginHistory.fulfilled, (s, a) => {
                s.loading = false;
                s.list    = a.payload.data;
                s.meta    = a.payload.meta;
            })
            .addCase(fetchLoginHistory.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            .addCase(fetchUserLoginHistory.fulfilled, (s, a) => {
                s.byUser[a.payload.userId] = {
                    user:    a.payload.user,
                    history: a.payload.history,
                    meta:    a.payload.meta,
                };
            });
    },
});

export default slice.reducer;

export const selectLoginHistory        = (s) => s.adminLoginHistory.list;
export const selectLoginHistoryMeta    = (s) => s.adminLoginHistory.meta;
export const selectLoginHistoryLoading = (s) => s.adminLoginHistory.loading;
export const selectLoginHistoryError   = (s) => s.adminLoginHistory.error;
export const selectUserLoginHistory    = (s, userId) => s.adminLoginHistory.byUser[userId] ?? null;
