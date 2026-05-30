import { createSlice } from '@reduxjs/toolkit';

/**
 * adminContextSlice — the admin's currently-selected (company, domain)
 * context for module-data CRUD.
 *
 * Pick once in the UI (AdminContextBar); every subsequent request to
 * /admin/modules/* automatically carries the IDs via the
 * X-Admin-Company-Id and X-Admin-Domain-Id headers (attached by the
 * axios interceptor in src/api/client.js, validated server-side by
 * App\Http\Middleware\InjectsAdminContext). The admin never types an
 * ID into a payload again.
 *
 * Persisted to localStorage so the picker survives reloads.
 */

const STORAGE_KEY = 'admin_context_v1';

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { companyId: null, domainId: null };
        const v = JSON.parse(raw);
        return {
            companyId: typeof v.companyId === 'string' ? v.companyId : null,
            domainId:  typeof v.domainId  === 'string' ? v.domainId  : null,
        };
    } catch {
        return { companyId: null, domainId: null };
    }
}

function persist(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            companyId: state.companyId,
            domainId:  state.domainId,
        }));
    } catch { /* quota / private mode — non-fatal */ }
}

const slice = createSlice({
    name: 'adminContext',
    initialState: load(),
    reducers: {
        // Setting a company clears the domain unless explicitly preserved,
        // because the previous domain almost certainly belongs to another
        // tenant and would silently filter every list to zero rows.
        setCompany: (s, a) => {
            const companyId = a.payload || null;
            if (companyId !== s.companyId) {
                s.companyId = companyId;
                s.domainId  = null;
            }
            persist(s);
        },
        setDomain: (s, a) => {
            s.domainId = a.payload || null;
            persist(s);
        },
        clearContext: (s) => {
            s.companyId = null;
            s.domainId  = null;
            persist(s);
        },
    },
});

export const { setCompany, setDomain, clearContext } = slice.actions;
export default slice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────
export const selectAdminContextCompanyId = (s) => s.adminContext.companyId;
export const selectAdminContextDomainId  = (s) => s.adminContext.domainId;
export const selectAdminContext          = (s) => s.adminContext;

// Helper for code outside React (the axios client). Reads localStorage
// directly so the interceptor doesn't need a store reference.
export function readAdminContextHeaders() {
    const ctx = load();
    const headers = {};
    if (ctx.companyId) headers['X-Admin-Company-Id'] = ctx.companyId;
    if (ctx.domainId)  headers['X-Admin-Domain-Id']  = ctx.domainId;
    return headers;
}
