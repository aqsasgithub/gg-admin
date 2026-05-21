import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Mail, Loader2, Check, X, AlertCircle, Eye, MousePointer } from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import {
    fetchNotifications, fetchNotificationStats,
    selectNotifications, selectNotificationsMeta, selectNotificationsLoading, selectNotificationStats,
} from '../features/admin/adminNotificationsSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';

const INTEGRATION_OPTIONS = [
    { value: 'slack',   label: 'Slack' },
    { value: 'teams',   label: 'Teams' },
    { value: 'email',   label: 'Email' },
    { value: 'webhook', label: 'Webhook' },
];

const STATUS_OPTIONS = [
    { value: 'sent',      label: 'Sent' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'failed',    label: 'Failed' },
    { value: 'retrying',  label: 'Retrying' },
    { value: 'bounced',   label: 'Bounced' },
];

const STATUS_STYLES = {
    sent:      'bg-sky-100 text-sky-800 ring-sky-200',
    delivered: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    failed:    'bg-red-100 text-red-800 ring-red-200',
    retrying:  'bg-amber-100 text-amber-800 ring-amber-200',
    bounced:   'bg-orange-100 text-orange-800 ring-orange-200',
};

export default function NotificationLogPage() {
    const dispatch = useDispatch();
    const list     = useSelector(selectNotifications);
    const meta     = useSelector(selectNotificationsMeta);
    const loading  = useSelector(selectNotificationsLoading);
    const stats    = useSelector(selectNotificationStats);

    const [filters, setFilters] = useState({});
    const [page,    setPage]    = useState(1);

    useEffect(() => { dispatch(fetchNotifications({ ...filters, page, per_page: 50 })); }, [dispatch, filters, page]);
    useEffect(() => { dispatch(fetchNotificationStats({ window_days: 1 })); }, [dispatch]);

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                    <Mail size={22} /> Notification log
                </h1>
                <p className="text-sm text-slate-600">
                    Outbound notifications (Slack, Teams, email, webhooks). Delivery lifecycle from provider webhooks.
                </p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Sent (24h)"        value={stats?.total ?? '—'} />
                <Stat label="Delivered"         value={stats?.delivered ?? '—'} />
                <Stat label="Delivery rate"     value={stats?.delivery_rate_pct != null ? `${stats.delivery_rate_pct}%` : '—'} />
                <Stat label="Failed"            value={stats?.by_status?.failed ?? 0}
                      tone={(stats?.by_status?.failed ?? 0) > 0 ? 'critical' : 'default'} />
            </div>

            <AdminFilterBar
                filters={[
                    { key: 'search',      type: 'text',   label: 'Search', placeholder: 'Recipient, subject, message ID…' },
                    { key: 'integration', type: 'select', label: 'Integration', options: INTEGRATION_OPTIONS },
                    { key: 'status',      type: 'select', label: 'Status', options: STATUS_OPTIONS },
                    { key: 'template',    type: 'text',   label: 'Template' },
                    { key: 'recipient',   type: 'text',   label: 'Recipient' },
                    { key: 'failed_only', type: 'boolean', label: 'Failures only' },
                ]}
                value={filters}
                onChange={(v) => { setFilters(v); setPage(1); }}
                onClear={() => { setFilters({}); setPage(1); }}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Sent</th>
                            <th className="px-3 py-2 text-left">Integration</th>
                            <th className="px-3 py-2 text-left">Recipient / channel</th>
                            <th className="px-3 py-2 text-left">Subject / template</th>
                            <th className="px-3 py-2 text-left">Alert</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-center">Engagement</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !list.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">No notifications match.</td></tr>
                        ) : list.map((n) => (
                            <tr key={n.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                                    {n.created_at ? format(parseISO(n.created_at), 'MMM d, HH:mm:ss') : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-xs capitalize">{n.integration}</td>
                                <td className="px-3 py-2.5 text-xs">
                                    <div className="font-mono truncate max-w-[14rem]">{n.recipient ?? n.channel ?? '—'}</div>
                                </td>
                                <td className="px-3 py-2.5 text-xs">
                                    <div className="truncate max-w-[18rem]">{n.subject ?? '—'}</div>
                                    {n.template && <div className="text-[10px] text-slate-500">{n.template}</div>}
                                </td>
                                <td className="px-3 py-2.5">
                                    {n.alert_id ? (
                                        <Link to={`/alerts/${n.alert_id}`} className="text-xs font-mono text-guardian-navy hover:underline">
                                            {n.alert_id.slice(0, 8)}…
                                        </Link>
                                    ) : <span className="text-xs text-slate-400">—</span>}
                                </td>
                                <td className="px-3 py-2.5">
                                    <StatusPill status={n.status} />
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                    <div className="inline-flex items-center gap-1">
                                        {n.delivered_at && <Check size={11} className="text-emerald-600" title="delivered" />}
                                        {n.opened_at    && <Eye size={11} className="text-sky-600" title="opened" />}
                                        {n.clicked_at   && <MousePointer size={11} className="text-violet-600" title="clicked" />}
                                        {n.bounced_at   && <X size={11} className="text-red-600" title="bounced" />}
                                    </div>
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

function StatusPill({ status }) {
    const cls = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 ${cls}`}>
            {status}
        </span>
    );
}

function Stat({ label, value, tone = 'default' }) {
    const tones = { critical: 'text-red-600', default: 'text-guardian-navy' };
    return (
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className={`mt-0.5 text-xl font-semibold ${tones[tone]}`}>{value}</div>
        </div>
    );
}
