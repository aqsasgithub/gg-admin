import axios from 'axios';
import toast from 'react-hot-toast';
import { API_BASE_URL, ADMIN_TOKEN_STORAGE_KEY } from '../configs/environments';

/**
 * Axios instance used by every admin slice. Pulls the API origin from
 * configs/environments.js (which reads VITE_API_BASE_URL), attaches the
 * admin JWT from localStorage, and routes 401s through the auth slice's
 * logout side-effect.
 *
 * This file intentionally keeps no app state — the store dispatches are
 * wired via `setAuthHandlers` below so we don't create a circular
 * dependency between axios and the store.
 *
 * Token storage key is deliberately distinct from the customer client's
 * `access_token` (see configs/environments.js).
 */

const apiRequest = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
});

// --- Token & logout handlers wired in by the store ----------------------

let tokenGetter = () => localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
let onUnauthorized = () => {};
let onForbidden = (msg) => toast.error(msg || 'Forbidden');

export function setAuthHandlers({ getToken, onUnauthorized: u, onForbidden: f }) {
    if (getToken)      tokenGetter    = getToken;
    if (u)             onUnauthorized = u;
    if (f)             onForbidden    = f;
}

// --- Request interceptor ------------------------------------------------

apiRequest.interceptors.request.use((config) => {
    const token = tokenGetter();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// --- Response interceptor -----------------------------------------------

apiRequest.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        const data   = error?.response?.data;

        if (status === 401) {
            // Token bad / expired. The auth slice clears storage + routes
            // to /login through the handler installed at app boot.
            onUnauthorized();
        } else if (status === 403) {
            // Forbidden — surface the reason. Useful when EnsureAdminOrigin
            // rejects a request, which returns a `reason` field.
            const message = data?.reason || data?.message || 'Access denied';
            if (!error.config?.silent403) onForbidden(message);
        } else if (status === 402) {
            // License problem — surface the message; controllers return
            // 'You have reached your plan limit...' here.
            toast.error(data?.message || 'License limit reached');
        }

        return Promise.reject(error);
    }
);

export default apiRequest;
