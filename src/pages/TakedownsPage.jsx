import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Sword, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchTakedowns, fetchTakedownStats,
    selectTakedowns, selectTakedownsMeta, selectTakedownsLoading, selectTakedownStats,
} from '../features/admin/adminTakedownsSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';

/**
 * Cross-tenant takedown queue. Status, severity, and abuse_kind match
 * the real customer-side schema. The queue surfaces SLA-breached cases
 * via colour + a `breached` filter; severity drives sort order
 * alongside status precedence.
 */

const STATUS_OPTIONS = [
    { value: 'open',                label: 'Open' },
    { value: 'evidence_collecting', label: 'Evidence collecting' },
    { value: 'submitting',          label: 'Submitting' },
    { value: 'in_progress',         label: 'In progress' },
    { value: 'resolved',            label: 'Resolved' },
    { value: 'expired',             label: 'Expired' },
    { value: 'rejected',            label: 'Rejected' },
    { value: 'closed',              label: 'Closed (admin)' },
];

const SEVERITY_OPTIONS = [
    { value: 'critical', label: 'Critical' },
    { value: 'high',     label: 'High' },
    { value: 'medium',   label: 'Medium' },
    { value: 'low',      label: 'Low' },
];

const ABUSE_OPTIONS = [
    { value: 'phishing',             label: 'Phishing' },
    { value: 'malware_distribution', label: 'Malware' },
    { value: 'brand_impersonation',  label: 'Brand impersonation' },
    { value: 'fraud',                label: 'Fraud' },
    { value: 'fake_app',             label: 'Fake app' },
    { value: 'pii_exposure',         label: 'PII exposure' },
    { value: 'trademark_violation',  label: 'Trademark' },
    { value: 'copyright_violation',  label: 'Copyright' },
    { value: 'other',                label: 'Other' },
];

const STATUS_STYLES = {
    open:                'bg-sky-100 text-sky-800 ring-sky-200',
    evidence_collecting: 'bg-violet-100 text-violet-800 ring-violet-200',
    submitting:          'bg-amber-100 text-amber-800 ring-amber-200',
    in_progress:         'bg-blue-100 text-blue-800 ring-blue-200',
    resolved:            'bg-emerald-100 text-emerald-800 ring-emerald-200',
    expired:             'bg-orange-100 text-orange-800 ring-orange-200',
    rejected:            'bg-red-100 text-red-800 ring-red-200',
    closed:              'bg-slate-200 text-slate-700 ring-slate-300',
};

const SEVERITY_STYLES = {
    critical: 'bg-red-100 text-red-800 ring-red-200',
    high:     'bg-orange-100 text-orange-800 ring-orange-200',
    medium:   'bg-amber-100 text-amber-800 ring-amber-200',
    low:      'bg-emerald-100 text-emerald-800 ring-emerald-200',
};

export function TakedownStatusPill({ status }) {
    const cls = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 capitalize ${cls}`}>
            {String(status ?? 'unknown').replace(/_/g, ' ')}
        </span>
    );
}

export function SeverityPill({ severity }) {
    const cls = SEVERITY_STYLES[severity] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 capitalize ${cls}`}>
            {severity ?? '—'}
        </span>
    );
}

export default function TakedownsPage() {
    const dispatch = useDispatch();
    const list     = useSelector(selectTakedowns);
    const meta     = useSelector(selectTakedownsMeta);
    const loading  = useSelector(selectTakedownsLoading);
    const stats    = useSelector(selectTakedownStats);

    const [filters, setFilters] = useState({ open_only: true });
    const [page,    setPage]    = useState(1);

    useEffect(() => {
        dispatch(fetchTakedowns({ ...filters, page, per_page: 50 }));
    }, [dispatch, filters, page]);
    useEffect(() => { dispatch(fetchTakedownStats()); }, [dispatch]);

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                    <Sword size={22} /> Takedowns
                </h1>
                <p className="text-sm text-slate-600">
                    Cross-tenant takedown queue. Case status is driven by the customer-side state
                    machine — admins can assign, change severity, add notes, and force-resolve / force-close.
                </p>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat label="Open total"          value={stats?.open_total ?? '—'} />
                <Stat label="SLA breached"        value={stats?.sla_breached ?? '—'}
                      tone={stats?.sla_breached > 0 ? 'critical' : 'default'} />
                <Stat label="Resolved (window)"   value={stats?.resolved_in_window ?? '—'} />
                <Stat label="Median TTR (hours)"  value={stats?.median_ttr_hours ?? '—'} />
                <Stat label="Window (days)"       value={stats?.window_days ?? '—'} />
            </div>

            {/* Filters */}
            <AdminFilterBar
                filters={[
                    { key: 'search',       type: 'text',   label: 'Search', placeholder: 'Case ID, URL, brand…' },
                    { key: 'status',       type: 'select', label: 'Status',     options: STATUS_OPTIONS },
                    { key: 'severity',     type: 'select', label: 'Severity',   options: SEVERITY_OPTIONS },
                    { key: 'abuse_kind',   type: 'select', label: 'Abuse kind', options: ABUSE_OPTIONS },
                    { key: 'open_only',          type: 'boolean', label: 'Open only' },
                    { key: 'sla_breached_only',  type: 'boolean', label: 'SLA breached only' },
                ]}
                value={filters}
                onChange={(v) => { setFilters(v); setPage(1); }}
                onClear={() => { setFilters({ open_only: true }); setPage(1); }}
            />

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Case</th>
                            <th className="px-3 py-2 text-left">Target</th>
                            <th className="px-3 py-2 text-left">Company</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Severity</th>
                            <th className="px-3 py-2 text-left">Abuse kind</th>
                            <th className="px-3 py-2 text-left">SLA</th>
                            <th className="px-3 py-2 text-left">Opened</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !list.length ? (
                            <tr><td colSpan="8" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="8" className="px-3 py-8 text-center text-slate-500">
                                No takedown cases match this filter.
                            </td></tr>
                        ) : list.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2.5">
                                    <Link to={`/takedowns/${c.id}`}
                                        className="font-mono text-xs text-guardian-navy hover:underline">
                                        {c.id}
                                    </Link>
                                    {c.protected_brand && (
                                        <div className="text-[10px] text-slate-500 truncate max-w-[12rem]">
                                            brand: {c.protected_brand}
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 py-2.5 text-xs">
                                    {c.primary_target
                                        ? <code className="text-slate-700 truncate inline-block max-w-xs">{c.primary_target}</code>
                                        : <span className="italic text-slate-400">no target</span>}
                                    {c.target_count > 1 && (
                                        <span className="ml-1 text-[10px] text-slate-500">+{c.target_count - 1} more</span>
                                    )}
                                </td>
                                <td className="px-3 py-2.5">
                                    <Link to={`/companies/${c.company_id}?tab=takedowns`}
                                        className="text-xs font-mono text-slate-700 hover:underline">
                                        {c.company_id}
                                    </Link>
                                </td>
                                <td className="px-3 py-2.5"><TakedownStatusPill status={c.status} /></td>
                                <td className="px-3 py-2.5"><SeverityPill severity={c.severity} /></td>
                                <td className="px-3 py-2.5 text-xs text-slate-700 capitalize">
                                    {c.abuse_kind?.replace(/_/g, ' ') ?? '—'}
                                </td>
                                <td className="px-3 py-2.5">
                                    {c.sla_due_at ? (
                                        <span className={`inline-flex items-center gap-1 text-xs ${c.sla_breached ? 'text-red-700 font-semibold' : 'text-slate-600'}`}>
                                            {c.sla_breached
                                                ? <AlertTriangle size={11} />
                                                : <Clock size={11} className="text-slate-400" />}
                                            {c.sla_hours_remaining < 0
                                                ? `${Math.abs(c.sla_hours_remaining)}h over`
                                                : `${c.sla_hours_remaining}h left`}
                                        </span>
                                    ) : <span className="text-xs text-slate-400">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">
                                    {c.created_at ? formatDistanceToNow(parseISO(c.created_at), { addSuffix: true }) : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {meta && meta.last_page > 1 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-sm">
                        <div className="text-slate-600">Page {meta.current_page} of {meta.last_page} · {meta.total} cases</div>
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
