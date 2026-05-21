/**
 * Centralized environment-variable access. Importing from here (rather than
 * sprinkling `import.meta.env.FOO` throughout the codebase) keeps env
 * reads in one place and makes it easy to add validation / fallbacks.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const APP_ENV      = import.meta.env.VITE_APP_ENV || 'development';

// Idle-timeout watchdog. Admin sessions auto-logout after this many minutes
// of no user activity (Layout.jsx installs the listener).
export const IDLE_TIMEOUT_MINUTES = Number(
    import.meta.env.VITE_IDLE_TIMEOUT_MINUTES || 15
);

// localStorage key for the admin JWT. Deliberately distinct from the
// customer app's `access_token` so the two sessions can't bleed into
// each other on a shared device / browser profile.
export const ADMIN_TOKEN_STORAGE_KEY = 'admin_token';
