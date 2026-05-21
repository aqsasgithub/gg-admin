import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

/**
 * adminUsersSlice — cross-tenant user administration.
 *
 * Backed by /api/admin/users*. Each thunk maps 1:1 to a route on
 * AdminUserController. The slice is keyed by a single list/byId map
 * because the admin search/filter UI always operates over the whole
 * platform set, not per-company.
 */

const API_CONFIG = { showSuccessToast: false, showErrorToast: false };
const errorOf = (e) => e?.response?.data?.message || e?.message || 'Admin user request failed';

// ── Thunks ────────────────────────────────────────────────────────────────

export const fetchAdminUsers = createAsyncThunk(
    'adminUsers/fetchAdminUsers',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/users', { ...API_CONFIG, params });
            return { data: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) {
            return rejectWithValue(errorOf(e));
        }
    },
);

export const fetchAdminUser = createAsyncThunk(
    'adminUsers/fetchAdminUser',
    async (userId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/users/${userId}`, API_CONFIG);
            return res.data?.data;
        } catch (e) {
            return rejectWithValue(errorOf(e));
        }
    },
);

export const inviteUser = createAsyncThunk(
    'adminUsers/inviteUser',
    async (payload, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post('/admin/users/invite', payload, API_CONFIG);
            toast.success(`Invited ${payload.email}`);
            return res.data?.data;
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue(errorOf(e));
        }
    },
);

export const suspendUser = createAsyncThunk(
    'adminUsers/suspendUser',
    async ({ userId, reason }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/users/${userId}/suspend`, { reason }, API_CONFIG);
            toast.success('User suspended');
            return res.data?.data;
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue(errorOf(e));
        }
    },
);

export const reinstateUser = createAsyncThunk(
    'adminUsers/reinstateUser',
    async (userId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/users/${userId}/reinstate`, {}, API_CONFIG);
            toast.success('User reinstated');
            return res.data?.data;
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue(errorOf(e));
        }
    },
);

export const resetUserPassword = createAsyncThunk(
    'adminUsers/resetUserPassword',
    async (userId, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/users/${userId}/reset-password`, {}, API_CONFIG);
            toast.success(`Reset email sent to ${res.data?.data?.email_sent_to ?? 'user'}`);
            return res.data?.data;
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue(errorOf(e));
        }
    },
);

export const grantAdminRole = createAsyncThunk(
    'adminUsers/grantAdminRole',
    async ({ userId, role, scopedCompanyId }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/users/${userId}/roles`, {
                role,
                scoped_company_id: scopedCompanyId ?? null,
            }, API_CONFIG);
            toast.success(`Granted ${role}`);
            return { userId, role: res.data?.data };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue(errorOf(e));
        }
    },
);

export const revokeAdminRole = createAsyncThunk(
    'adminUsers/revokeAdminRole',
    async ({ userId, role, reason }, { rejectWithValue }) => {
        try {
            await apiRequest.delete(`/admin/users/${userId}/roles/${role}`, {
                ...API_CONFIG,
                data: { reason },
            });
            toast.success(`Revoked ${role}`);
            return { userId, role };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue(errorOf(e));
        }
    },
);

// ── Slice ─────────────────────────────────────────────────────────────────

const initial = {
    list:    [],
    meta:    null,
    byId:    {},
    loading: false,
    error:   null,
    working: {},          // per-user in-flight transitions keyed by id
};

const adminUsersSlice = createSlice({
    name: 'adminUsers',
    initialState: initial,
    reducers: {
        clearAdminUserError: (s) => { s.error = null; },
    },
    extraReducers: (b) => {
        b
            .addCase(fetchAdminUsers.pending,    (s) => { s.loading = true;  s.error = null; })
            .addCase(fetchAdminUsers.fulfilled,  (s, a) => {
                s.loading = false;
                s.list = a.payload.data;
                s.meta = a.payload.meta;
            })
            .addCase(fetchAdminUsers.rejected,   (s, a) => { s.loading = false; s.error = a.payload; })

            .addCase(fetchAdminUser.fulfilled,   (s, a) => {
                if (a.payload?.id) s.byId[a.payload.id] = a.payload;
            })

            .addCase(suspendUser.pending,        (s, a) => { s.working[a.meta.arg.userId] = 'suspend'; })
            .addCase(suspendUser.fulfilled,      (s, a) => {
                delete s.working[a.payload?.id];
                patchRow(s, a.payload);
            })
            .addCase(suspendUser.rejected,       (s, a) => { delete s.working[a.meta.arg.userId]; })

            .addCase(reinstateUser.pending,      (s, a) => { s.working[a.meta.arg] = 'reinstate'; })
            .addCase(reinstateUser.fulfilled,    (s, a) => {
                delete s.working[a.payload?.id];
                patchRow(s, a.payload);
            })
            .addCase(reinstateUser.rejected,     (s, a) => { delete s.working[a.meta.arg]; })

            .addCase(inviteUser.fulfilled,       () => { /* list refresh handled by caller */ });
    },
});

function patchRow(state, updated) {
    if (!updated?.id) return;
    const i = state.list.findIndex((u) => u.id === updated.id);
    if (i !== -1) state.list[i] = { ...state.list[i], ...updated };
    if (state.byId[updated.id]) state.byId[updated.id] = { ...state.byId[updated.id], ...updated };
}

export const { clearAdminUserError } = adminUsersSlice.actions;
export default adminUsersSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────
export const selectAdminUsers          = (s) => s.adminUsers.list;
export const selectAdminUsersMeta      = (s) => s.adminUsers.meta;
export const selectAdminUsersLoading   = (s) => s.adminUsers.loading;
export const selectAdminUsersError     = (s) => s.adminUsers.error;
export const selectAdminUserById       = (s, id) => s.adminUsers.byId[id] ?? null;
export const selectAdminUserWorking    = (s, id) => s.adminUsers.working[id] ?? null;
