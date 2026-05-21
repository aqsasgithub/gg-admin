import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import apiRequest from '../../api/client';

/**
 * Admin takedown case management. Reads + mutates rows in the existing
 * customer-side takedown_cases / takedown_submissions / takedown_events
 * tables.
 *
 * Important: case status is DERIVED by the customer-side
 * CaseStateMachine from submissions + liveness probes. This slice
 * deliberately does NOT expose a generic "transition" thunk. Admins
 * only have:
 *   - assign / updateSeverity / updateMetadata / addNote — non-status
 *   - forceClose / forceResolve — terminal admin overrides, audited
 */

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Takedown request failed';

// ── Queue ────────────────────────────────────────────────────────────────

export const fetchTakedowns = createAsyncThunk(
    'adminTakedowns/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/takedowns', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    },
);

export const fetchCompanyTakedowns = createAsyncThunk(
    'adminTakedowns/fetchForCompany',
    async ({ companyId, ...params }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/takedowns`, { ...CFG, params });
            return { companyId, list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue({ companyId, error: errOf(e) }); }
    },
);

export const fetchTakedownStats = createAsyncThunk(
    'adminTakedowns/stats',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/takedowns/stats', { ...CFG, params });
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    },
);

// ── Detail ───────────────────────────────────────────────────────────────

export const fetchTakedown = createAsyncThunk(
    'adminTakedowns/fetchOne',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/takedowns/${id}`, CFG);
            return { id, detail: res.data?.data };
        } catch (e) { return rejectWithValue({ id, error: errOf(e) }); }
    },
);

// ── Mutations admins are allowed to perform ──────────────────────────────

export const assignTakedown = createAsyncThunk(
    'adminTakedowns/assign',
    async ({ id, userId }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/takedowns/${id}/assign`, { user_id: userId }, CFG);
            toast.success(userId ? 'Assigned' : 'Unassigned');
            return { id, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue({ id, error: errOf(e) }); }
    },
);

export const updateTakedownSeverity = createAsyncThunk(
    'adminTakedowns/severity',
    async ({ id, severity, reason }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/takedowns/${id}/severity`, { severity, reason }, CFG);
            toast.success(`Severity set to ${severity}`);
            return { id, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue({ id, error: errOf(e) }); }
    },
);

export const updateTakedownMetadata = createAsyncThunk(
    'adminTakedowns/metadata',
    async ({ id, ...payload }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/takedowns/${id}/metadata`, payload, CFG);
            toast.success('Updated');
            return { id, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue({ id, error: errOf(e) }); }
    },
);

export const addTakedownNote = createAsyncThunk(
    'adminTakedowns/note',
    async ({ id, note, visibility = 'internal' }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/takedowns/${id}/notes`, { note, visibility }, CFG);
            toast.success('Note added');
            return { id, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue({ id, error: errOf(e) }); }
    },
);

export const forceCloseTakedown = createAsyncThunk(
    'adminTakedowns/forceClose',
    async ({ id, reason }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/takedowns/${id}/force-close`, { reason }, CFG);
            toast.success('Case force-closed');
            return { id, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue({ id, error: errOf(e) }); }
    },
);

export const forceResolveTakedown = createAsyncThunk(
    'adminTakedowns/forceResolve',
    async ({ id, reason }, { rejectWithValue }) => {
        try {
            const res = await apiRequest.post(`/admin/takedowns/${id}/force-resolve`, { reason }, CFG);
            toast.success('Case force-resolved');
            return { id, detail: res.data?.data };
        } catch (e) { toast.error(errOf(e)); return rejectWithValue({ id, error: errOf(e) }); }
    },
);

// ── Slice ────────────────────────────────────────────────────────────────

const slice = createSlice({
    name: 'adminTakedowns',
    initialState: {
        list:    [],
        meta:    null,
        stats:   null,
        byId:    {},
        byCompany: {},      // companyId -> {list, meta}
        loading: false,
    },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchTakedowns.pending,    (s) => { s.loading = true; })
            .addCase(fetchTakedowns.fulfilled,  (s, a) => { s.loading = false; s.list = a.payload.list; s.meta = a.payload.meta; })
            .addCase(fetchTakedowns.rejected,   (s, a) => { s.loading = false; toast.error(a.payload); })

            .addCase(fetchCompanyTakedowns.fulfilled, (s, a) => {
                s.byCompany[a.payload.companyId] = { list: a.payload.list, meta: a.payload.meta };
            })

            .addCase(fetchTakedownStats.fulfilled, (s, a) => { s.stats = a.payload; })

            .addCase(fetchTakedown.fulfilled, (s, a) => {
                s.byId[a.payload.id] = a.payload.detail;
            });

        // Every mutation thunk returns the full re-rendered detail —
        // refresh byId and patch the row in the list.
        const writeBack = (s, action) => {
            const { id, detail } = action.payload ?? {};
            if (!id || !detail) return;
            s.byId[id] = detail;
            const summary = detail.case ?? detail;
            const i = s.list.findIndex((r) => r.id === id);
            if (i >= 0) s.list[i] = { ...s.list[i], ...summary };
            Object.values(s.byCompany).forEach((bucket) => {
                const j = bucket.list?.findIndex((r) => r.id === id);
                if (j >= 0) bucket.list[j] = { ...bucket.list[j], ...summary };
            });
        };
        [
            assignTakedown, updateTakedownSeverity, updateTakedownMetadata,
            addTakedownNote, forceCloseTakedown, forceResolveTakedown,
        ].forEach((thunk) => b.addCase(thunk.fulfilled, writeBack));
    },
});

export default slice.reducer;

// ── Selectors ────────────────────────────────────────────────────────────
export const selectTakedowns         = (s) => s.adminTakedowns.list;
export const selectTakedownsMeta     = (s) => s.adminTakedowns.meta;
export const selectTakedownsLoading  = (s) => s.adminTakedowns.loading;
export const selectTakedownStats     = (s) => s.adminTakedowns.stats;
export const selectTakedown          = (s, id) => s.adminTakedowns.byId[id] ?? null;
export const selectCompanyTakedowns  = (s, cid) => s.adminTakedowns.byCompany[cid]?.list ?? [];
