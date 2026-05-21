import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';
import { ADMIN_TOKEN_STORAGE_KEY as TOKEN_KEY } from '../../configs/environments';

/**
 * Admin portal auth. Reuses the same backend endpoints as the customer
 * app (login → OTP → me), but stores its token in a distinct localStorage
 * key (see configs/environments.js) so the two apps don't share a
 * session — which is the whole point of running this on a separate
 * origin in the first place.
 *
 * Flow:
 *   1. POST /login              → sends OTP, returns success message
 *   2. POST /verify-otp         → returns { token, user }
 *   3. GET  /user               → returns { user } including admin_roles
 *
 * URL note: this server mounts auth endpoints at the root of /api (so
 * the full path is /api/login, /api/verify-otp, /api/logout) — NOT under
 * an /auth/ prefix. The bundle's original implementation assumed an
 * /auth/ prefix; we strip it here to match the actual server.
 *
 * If the user has no admin_roles, we refuse the login at step 3 and
 * clear the token immediately. Customer accounts cannot accidentally
 * end up signed in here.
 */

const errorOf = (e) => e?.response?.data?.message || e?.message || 'Authentication failed';

// ── Thunks ────────────────────────────────────────────────────────────────

export const requestLoginOtp = createAsyncThunk(
    'auth/requestLoginOtp',
    async ({ email, password }, { rejectWithValue }) => {
        try {
            await apiRequest.post('/login', { email, password });
            toast.success('OTP sent to your email');
            return { email };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue(errorOf(e));
        }
    },
);

export const verifyOtp = createAsyncThunk(
    'auth/verifyOtp',
    async ({ email, otp }, { rejectWithValue, dispatch }) => {
        try {
            const res = await apiRequest.post('/verify-otp', { email, otp });
            const token = res.data?.token;
            const user  = res.data?.user;

            if (!token) throw new Error('No token returned.');

            // Persist + immediately verify admin entitlement. We do the
            // admin check here rather than letting the user land on /admin
            // and bounce, because the post-OTP moment is the right place
            // to refuse a non-admin login decisively.
            localStorage.setItem(TOKEN_KEY, token);

            const adminRoles = user?.admin_roles ?? [];
            if (adminRoles.length === 0) {
                localStorage.removeItem(TOKEN_KEY);
                throw new Error('This account has no admin role. Sign in to the customer app instead.');
            }

            return { token, user };
        } catch (e) {
            toast.error(errorOf(e));
            return rejectWithValue(errorOf(e));
        }
    },
);

export const fetchCurrentUser = createAsyncThunk(
    'auth/fetchCurrentUser',
    async (_, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/user', { silent403: true });
            const user = res.data?.user ?? res.data?.data ?? res.data;
            if (!user?.admin_roles?.length) {
                return rejectWithValue('Not an admin');
            }
            return user;
        } catch (e) {
            return rejectWithValue(errorOf(e));
        }
    },
);

export const logout = createAsyncThunk(
    'auth/logout',
    async (_, { dispatch }) => {
        try { await apiRequest.post('/logout', {}, { silent403: true }); } catch { /* ignore */ }
        localStorage.removeItem(TOKEN_KEY);
        return null;
    },
);

// ── Slice ─────────────────────────────────────────────────────────────────

const initialState = {
    user:        null,
    token:       localStorage.getItem(TOKEN_KEY) ?? null,
    awaitingOtp: false,
    otpEmail:    null,
    bootLoading: false,        // hydrating from token on app start
    loading:     false,
    error:       null,
};

const slice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        clearAuthError: (s) => { s.error = null; },
        forceLogout:    (s) => {
            localStorage.removeItem(TOKEN_KEY);
            s.user = null; s.token = null;
        },
    },
    extraReducers: (b) => {
        b
            .addCase(requestLoginOtp.pending,   (s) => { s.loading = true;  s.error = null; })
            .addCase(requestLoginOtp.fulfilled, (s, a) => {
                s.loading = false;
                s.awaitingOtp = true;
                s.otpEmail = a.payload.email;
            })
            .addCase(requestLoginOtp.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            .addCase(verifyOtp.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(verifyOtp.fulfilled, (s, a) => {
                s.loading = false;
                s.token   = a.payload.token;
                s.user    = a.payload.user;
                s.awaitingOtp = false;
                s.otpEmail    = null;
            })
            .addCase(verifyOtp.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            .addCase(fetchCurrentUser.pending,   (s) => { s.bootLoading = true; })
            .addCase(fetchCurrentUser.fulfilled, (s, a) => {
                s.bootLoading = false;
                s.user = a.payload;
            })
            .addCase(fetchCurrentUser.rejected,  (s) => {
                s.bootLoading = false;
                localStorage.removeItem(TOKEN_KEY);
                s.user = null; s.token = null;
            })

            .addCase(logout.fulfilled, (s) => {
                s.user = null; s.token = null; s.awaitingOtp = false; s.otpEmail = null;
            });
    },
});

export const { clearAuthError, forceLogout } = slice.actions;
export default slice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────
export const selectAuthUser            = (s) => s.auth.user;
export const selectAuthToken           = (s) => s.auth.token;
export const selectIsAuthenticated     = (s) => Boolean(s.auth.user);
export const selectAuthLoading         = (s) => s.auth.loading;
export const selectAuthBootLoading     = (s) => s.auth.bootLoading;
export const selectAwaitingOtp         = (s) => s.auth.awaitingOtp;
export const selectOtpEmail            = (s) => s.auth.otpEmail;
export const selectAuthError           = (s) => s.auth.error;
export const selectAdminCapabilities   = (s) => s.auth.user?.admin_capabilities ?? [];
export const selectAdminRoles          = (s) => s.auth.user?.admin_roles ?? [];

export const selectHasCapability = (capability) => (s) => {
    const caps = s.auth.user?.admin_capabilities ?? [];
    return caps.includes('*') || caps.includes(capability);
};
