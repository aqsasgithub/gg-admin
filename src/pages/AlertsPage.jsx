import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Loader2, CheckSquare, Square } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchAlerts, fetchAlertStats, bulkTransitionAlerts,
    selectAlerts, selectAlertsMeta, selectAlertsLoading, selectAlertStats,
} from '../features/admin/adminAlertsSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';

const STATUS_OPTIONS = [
    { value: 'open',           label: 'Open' },
    { value: 'acknowledged',   label: 'Acknowledged' },
    { value: 'in_progress',    label: 'In progress' },
    { value: 'resolved',       label: 'Resolved' },
    { value: 'suppressed',     label: 'Suppressed' },
    { value: 'false_positive', label: 'False positive' },
    { value: 'accepted_risk',  label: 'Accepted risk' },
];

const SEVERITY_OPTIONS = [
    { value: 'critical', label: 'Critical' },
    { value: 'high',     label: 'High' },
    { value: 'medium',   label: 'Medium' },
    { value: 'low',      label: 'Low' },
    { value: 'info',     label: 'Info' },
];

const STATUS_STYLES = {
    open:           'bg-sky-100 text-sky-800 ring-sky-200',
    acknowledged:   'bg-violet-100 text-violet-800 ring-violet-200',
    in_progress:    'bg-blue-100 text-blue-800 ring-blue-200',
    resolved:       'bg-emerald-100 text-emerald-800 ring-emerald-200',
    suppressed:     'bg-slate-200 text-slate-700 ring-slate-300',
    false_positive: 'bg-amber-100 text-amber-800 ring-amber-200',
    accepted_risk:  'bg-orange-100 text-orange-800 ring-orange-200',
};

const SEVERITY_STYLES = {
    critical: 'bg-red-100 text-red-800 ring-red-200',
    high:     'bg-orange-100 text-orange-800 ring-orange-200',
    medium:   'bg-amber-100 text-amber-800 ring-amber-200',
    low:      'bg-emerald-100 text-emerald-800 ring-emerald-200',
    info:     'bg-slate-100 text-slate-700 ring-slate-200',
};

export function AlertStatusPill({ status }) {
    const cls = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 ${cls}`}>
            {String(status ?? 'unknown').replace(/_/g, ' ')}
        </span>
    );
}

export function AlertSeverityPill({ severity }) {
    const cls = SEVERITY_STYLES[severity] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 capitalize ${cls}`}>
            {severity ?? '—'}
        </span>
    );
}

export default function AlertsPage() {
    const dispatch = useDispatch();
    const list     = useSelector(selectAlerts);
    const meta     = useSelector(selectAlertsMeta);
    const loading  = useSelector(selectAlertsLoading);
    const stats    = useSelector(selectAlertStats);

    const [filters,  setFilters]  = useState({ open_only: true });
    const [page,     setPage]     = useState(1);
    const [selected, setSelected] = useState(new Set());
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkTo,   setBulkTo]   = useState('acknowledged');

    useEffect(() => {
        dispatch(fetchAlerts({ ...filters, page, per_page: 50 }));
    }, [dispatch, filters, page]);
    useEffect(() => { dispatch(fetchAlertStats()); }, [dispatch]);

    const toggleAll = () => {
        if (selected.size === list.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(list.map((a) => a.id)));
        }
    };
    const toggleOne = (id) => {
        const next = new Set(selected);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelected(next);
    };

    return (
        <div className="p-6 space-y-4">
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                        <AlertTriangle size={22} /> Alerts
                    </h1>
                    <p className="text-sm text-slate-600">
                        Cross-tenant alert queue. Transitions go through the customer-side AlertWorkflowService.
                    </p>
                </div>
                {selected.size > 0 && (
                    <button type="button" onClick={() => setBulkOpen(true)}
                        className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 text-white rounded-md">
                        Bulk transition ({selected.size})
                    </button>
                )}
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Open total"     value={stats?.open_total     ?? '—'} />
                <Stat label="SLA breached"   value={stats?.sla_breached   ?? '—'}
                      tone={(stats?.sla_breached ?? 0) > 0 ? 'critical' : 'default'} />
                <Stat label="Total"          value={stats?.total          ?? '—'} />
                <Stat label="Critical (open)" value={stats?.by_severity?.critical ?? 0} />
            </div>

            <AdminFilterBar
                filters={[
                    { key: 'search',     type: 'text',   label: 'Search', placeholder: 'Title, asset, finding key…' },
                    { key: 'status',     type: 'select', label: 'Status',   options: STATUS_OPTIONS },
                    { key: 'severity',   type: 'select', label: 'Severity', options: SEVERITY_OPTIONS },
                    { key: 'module',     type: 'text',   label: 'Module' },
                    { key: 'open_only',          type: 'boolean', label: 'Open only' },
                    { key: 'sla_breached_only',  type: 'boolean', label: 'SLA breached' },
                ]}
                value={filters}
                onChange={(v) => { setFilters(v); setPage(1); setSelected(new Set()); }}
                onClear={() => { setFilters({ open_only: true }); setPage(1); setSelected(new Set()); }}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 w-8">
                                <button type="button" onClick={toggleAll} className="text-slate-400 hover:text-slate-700">
                                    {selected.size === list.length && list.length > 0
                                        ? <CheckSquare size={14} />
                                        : <Square size={14} />}
                                </button>
                            </th>
                            <th className="px-3 py-2 text-left">Alert</th>
                            <th className="px-3 py-2 text-left">Module</th>
                            <th className="px-3 py-2 text-left">Company</th>
                            <th className="px-3 py-2 text-left">Severity</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">SLA</th>
                            <th className="px-3 py-2 text-left">Last seen</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !list.length ? (
                            <tr><td colSpan="8" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="8" className="px-3 py-8 text-center text-slate-500">No alerts match.</td></tr>
                        ) : list.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2.5">
                                    <button type="button" onClick={() => toggleOne(a.id)} className="text-slate-400 hover:text-slate-700">
                                        {selected.has(a.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                                    </button>
                                </td>
                                <td className="px-3 py-2.5">
                                    <Link to={`/alerts/${a.id}`} className="font-medium text-guardian-navy hover:underline">
                                        {a.title}
                                    </Link>
                                    {a.affected_asset && (
                                        <div className="text-xs text-slate-500 truncate max-w-[20rem]">
                                            <code>{a.affected_asset}</code>
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-700">{a.module ?? '—'}</td>
                                <td className="px-3 py-2.5">
                                    <Link to={`/companies/${a.company_id}?tab=alerts`}
                                        className="text-xs font-mono text-slate-700 hover:underline">
                                        {a.company_id}
                                    </Link>
                                </td>
                                <td className="px-3 py-2.5"><AlertSeverityPill severity={a.severity} /></td>
                                <td className="px-3 py-2.5"><AlertStatusPill status={a.status} /></td>
                                <td className="px-3 py-2.5">
                                    {a.sla_breach_at ? (
                                        <span className={`inline-flex items-center gap-1 text-xs ${a.sla_breached ? 'text-red-700 font-semibold' : 'text-slate-600'}`}>
                                            <Clock size={11} className={a.sla_breached ? '' : 'text-slate-400'} />
                                            {a.sla_state ?? 'tracked'}
                                        </span>
                                    ) : <span className="text-xs text-slate-400">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">
                                    {a.last_seen_at ? formatDistanceToNow(parseISO(a.last_seen_at), { addSuffix: true }) : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {meta && meta.last_page > 1 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-sm">
                        <div className="text-slate-600">Page {meta.current_page} of {meta.last_page} · {meta.total} alerts</div>
                        <div className="flex gap-1">
                            <button type="button" disabled={meta.current_page <= 1}
                                onClick={() => setPage((p) => p - 1)}
                                className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40">Previous</button>
                            <button type="button" disabled={meta.current_page >= meta.last_page}
                                onClick={() => setPage((p) => p + 1)}
                                className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40">Next</button>
                        </div>
                    </div>
                )}
            </div>

            {bulkOpen && (
                <BulkModal selectedCount={selected.size} bulkTo={bulkTo} setBulkTo={setBulkTo}
                    onCancel={() => setBulkOpen(false)}
                    onConfirm={async () => {
                        await dispatch(bulkTransitionAlerts({
                            alertIds: Array.from(selected),
                            to: bulkTo,
                        }));
                        setBulkOpen(false);
                        setSelected(new Set());
                        dispatch(fetchAlerts({ ...filters, page, per_page: 50 }));
                    }} />
            )}
        </div>
    );
}

function BulkModal({ selectedCount, bulkTo, setBulkTo, onCancel, onConfirm }) {
    const [busy, setBusy] = useState(false);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h3 className="text-base font-semibold">Bulk transition {selectedCount} alerts</h3>
                </div>
                <div className="p-5">
                    <label className="block text-xs font-medium text-slate-700 mb-1">Target status</label>
                    <select value={bulkTo} onChange={(e) => setBulkTo(e.target.value)}
                        className="w-full p-2 text-sm border border-slate-300 rounded-md">
                        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <p className="text-xs text-slate-500 mt-2">
                        Per-alert transitions that aren't allowed by the state machine will be skipped.
                    </p>
                </div>
                <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-700 hover:text-slate-900">
                        Cancel
                    </button>
                    <button type="button" disabled={busy}
                        onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}
                        className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 text-white rounded-md disabled:opacity-50">
                        {busy ? 'Transitioning…' : 'Transition'}
                    </button>
                </div>
            </div>
        </div>
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
