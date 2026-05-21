import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Ticket as TicketIcon, Loader2, ExternalLink, Check, X } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchTickets, fetchTicketStats,
    selectTickets, selectTicketsMeta, selectTicketsLoading, selectTicketStats,
} from '../features/admin/adminTicketsSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';
import { AlertSeverityPill } from './AlertsPage';

const INTEGRATION_OPTIONS = [
    { value: 'jira',       label: 'Jira' },
    { value: 'servicenow', label: 'ServiceNow' },
    { value: 'pagerduty',  label: 'PagerDuty' },
    { value: 'webhook',    label: 'Webhook' },
];

export default function TicketsPage() {
    const dispatch = useDispatch();
    const list    = useSelector(selectTickets);
    const meta    = useSelector(selectTicketsMeta);
    const loading = useSelector(selectTicketsLoading);
    const stats   = useSelector(selectTicketStats);

    const [filters, setFilters] = useState({});
    const [page,    setPage]    = useState(1);

    useEffect(() => { dispatch(fetchTickets({ ...filters, page, per_page: 50 })); }, [dispatch, filters, page]);
    useEffect(() => { dispatch(fetchTicketStats({ window_days: 7 })); }, [dispatch]);

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                    <TicketIcon size={22} /> Tickets
                </h1>
                <p className="text-sm text-slate-600">
                    External tickets created from alerts by the customer-side integration pipeline (Jira, ServiceNow, etc.).
                    Read-only — admins can observe but don't create or close tickets here.
                </p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Total"                value={stats?.total ?? '—'} />
                <Stat label="Created (7d)"         value={stats?.created_in_window ?? '—'} />
                <Stat label="Integrations in use"  value={stats?.by_integration ? Object.keys(stats.by_integration).length : '—'} />
                <Stat label="Window (days)"        value={stats?.window_days ?? '—'} />
            </div>

            <AdminFilterBar
                filters={[
                    { key: 'search',      type: 'text',   label: 'Search', placeholder: 'External ID, ticket ID…' },
                    { key: 'integration', type: 'select', label: 'Integration', options: INTEGRATION_OPTIONS },
                    { key: 'likely_open', type: 'boolean', label: 'Likely-open only' },
                ]}
                value={filters}
                onChange={(v) => { setFilters(v); setPage(1); }}
                onClear={() => { setFilters({}); setPage(1); }}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Ticket</th>
                            <th className="px-3 py-2 text-left">Integration</th>
                            <th className="px-3 py-2 text-left">External ID</th>
                            <th className="px-3 py-2 text-left">Alert</th>
                            <th className="px-3 py-2 text-left">External status</th>
                            <th className="px-3 py-2 text-center">Open?</th>
                            <th className="px-3 py-2 text-left">Created</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !list.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">No tickets match.</td></tr>
                        ) : list.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2.5 font-mono text-xs">{t.id.slice(0, 12)}…</td>
                                <td className="px-3 py-2.5 text-xs capitalize">{t.integration}</td>
                                <td className="px-3 py-2.5 text-xs">
                                    {t.external_url ? (
                                        <a href={t.external_url} target="_blank" rel="noopener noreferrer"
                                           className="inline-flex items-center gap-1 font-mono text-guardian-navy hover:underline">
                                            {t.external_id} <ExternalLink size={10} />
                                        </a>
                                    ) : <span className="font-mono">{t.external_id}</span>}
                                </td>
                                <td className="px-3 py-2.5 text-xs">
                                    {t.alert ? (
                                        <Link to={`/alerts/${t.alert.id}`} className="hover:underline">
                                            <div className="flex items-center gap-1">
                                                <AlertSeverityPill severity={t.alert.severity} />
                                                <span className="truncate max-w-[14rem]">{t.alert.title}</span>
                                            </div>
                                        </Link>
                                    ) : <span className="text-slate-400">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-700">{t.external_status ?? '—'}</td>
                                <td className="px-3 py-2.5 text-center">
                                    {t.likely_open
                                        ? <Check size={12} className="inline text-emerald-600" />
                                        : <X size={12} className="inline text-slate-400" />}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">
                                    {t.created_at ? formatDistanceToNow(parseISO(t.created_at), { addSuffix: true }) : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {meta && meta.last_page > 1 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-sm">
                        <div className="text-slate-600">Page {meta.current_page} of {meta.last_page} · {meta.total}</div>
                        <div className="flex gap-1">
                            <button type="button" disabled={meta.current_page <= 1}
                                onClick={() => setPage((p) => p - 1)} className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40">Previous</button>
                            <button type="button" disabled={meta.current_page >= meta.last_page}
                                onClick={() => setPage((p) => p + 1)} className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40">Next</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function Stat({ label, value }) {
    return (
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-0.5 text-xl font-semibold text-guardian-navy">{value}</div>
        </div>
    );
}
