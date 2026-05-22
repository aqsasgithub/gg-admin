import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Ticket control request failed';

export const fetchTicketControl = createAsyncThunk('ticketControl/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/ticket-control', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

// Drives create/close/reopen/escalate/retry-sync (action-based).
export const ticketControlAction = createAsyncThunk('ticketControl/action',
    async ({ id, action, body = {}, method = 'post' }, { rejectWithValue }) => {
        try {
            const url = id ? `/admin/ticket-control/${id}/${action}`.replace(/\/$/, '') : '/admin/ticket-control';
            const res = await apiRequest[method](id && action ? `/admin/ticket-control/${id}/${action}` : '/admin/ticket-control', body, CFG);
            return { data: res.data, status: res.status };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const createTicket = createAsyncThunk('ticketControl/create',
    async (body, { rejectWithValue }) => {
        try { const res = await apiRequest.post('/admin/ticket-control', body, CFG); return res.data; }
        catch (e) { return rejectWithValue(errOf(e)); }
    });

const slice = createSlice({
    name: 'adminTicketControl',
    initialState: { list: [], meta: null, loading: false, acting: false, lastError: null },
    reducers: { clearTicketControlError: (s) => { s.lastError = null; } },
    extraReducers: (b) => {
        b.addCase(fetchTicketControl.pending, (s) => { s.loading = true; })
         .addCase(fetchTicketControl.fulfilled, (s, a) => { s.loading = false; s.list = a.payload.list; s.meta = a.payload.meta; })
         .addCase(fetchTicketControl.rejected, (s, a) => { s.loading = false; s.lastError = a.payload; })
         .addCase(ticketControlAction.pending, (s) => { s.acting = true; })
         .addCase(ticketControlAction.fulfilled, (s) => { s.acting = false; })
         .addCase(ticketControlAction.rejected, (s, a) => { s.acting = false; s.lastError = a.payload; })
         .addCase(createTicket.fulfilled, (s) => { s.acting = false; });
    },
});
export const { clearTicketControlError } = slice.actions;
export default slice.reducer;
export const selectTicketControl = (s) => s.adminTicketControl.list;
export const selectTicketControlMeta = (s) => s.adminTicketControl.meta;
export const selectTicketControlLoading = (s) => s.adminTicketControl.loading;
export const selectTicketControlActing = (s) => s.adminTicketControl.acting;
