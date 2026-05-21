import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import apiRequest from '../../api/client';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Tickets request failed';

export const fetchTickets = createAsyncThunk('adminTickets/fetch',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/tickets', { ...CFG, params });
            return { list: res.data?.data ?? [], meta: res.data?.meta ?? null };
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchTicketStats = createAsyncThunk('adminTickets/stats',
    async (params = {}, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get('/admin/tickets/stats', { ...CFG, params });
            return res.data?.data;
        } catch (e) { return rejectWithValue(errOf(e)); }
    });

export const fetchTicket = createAsyncThunk('adminTickets/fetchOne',
    async (id, { rejectWithValue }) => {
        try {
            const res = await apiRequest.get(`/admin/tickets/${id}`, CFG);
            return { id, detail: res.data?.data };
        } catch (e) { return rejectWithValue({ id, error: errOf(e) }); }
    });

const slice = createSlice({
    name: 'adminTickets',
    initialState: { list: [], meta: null, stats: null, byId: {}, loading: false },
    reducers: {},
    extraReducers: (b) => {
        b
            .addCase(fetchTickets.pending,   (s) => { s.loading = true; })
            .addCase(fetchTickets.fulfilled, (s, a) => { s.loading = false; s.list = a.payload.list; s.meta = a.payload.meta; })
            .addCase(fetchTickets.rejected,  (s) => { s.loading = false; })

            .addCase(fetchTicketStats.fulfilled, (s, a) => { s.stats = a.payload; })
            .addCase(fetchTicket.fulfilled, (s, a) => { s.byId[a.payload.id] = a.payload.detail; });
    },
});

export default slice.reducer;

export const selectTickets        = (s) => s.adminTickets.list;
export const selectTicketsMeta    = (s) => s.adminTickets.meta;
export const selectTicketsLoading = (s) => s.adminTickets.loading;
export const selectTicketStats    = (s) => s.adminTickets.stats;
export const selectTicket         = (s, id) => s.adminTickets.byId[id] ?? null;
