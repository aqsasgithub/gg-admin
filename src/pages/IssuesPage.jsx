import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Bug, Clock, Loader2, CheckSquare, Square } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchIssues, fetchIssueStats, bulkCloseIssues, bulkReclassifyIssues,
    selectIssues, selectIssuesMeta, selectIssuesLoading, selectIssueStats,
} from '../features/admin/adminIssuesSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';

const STATUS_OPTIONS = [
    { value: 'open',          label: 'Open' },
    { value: 'in_progress',   label: 'In progress' },
    { value: 'investigating', label: 'Investigating' },
    { value: 'escalated',     label: 'Escalated' },
    { value: 'resolved',      label: 'Resolved' },
    { value: 'closed',        label: 'Closed' },
    { value: 'ignored',       label: 'Ignored' },
];

const SEVERITY_OPTIONS = [
    { value: 'critical', label: 'Critical' },
    { value: 'high',     label: 'High' },
    { value: 'medium',   label: 'Medium' },
    { value: 'low',      label: 'Low' },
];

const SEVERITY_STYLES = {
    critical: 'bg-red-100 text-red-800 ring-red-200',
    high:     'bg-orange-100 text-orange-800 ring-orange-200',
    medium:   'bg-amber-100 text-amber-800 ring-amber-200',
    low:      'bg-emerald-100 text-emerald-800 ring-emerald-200',
};

const STATUS_STYLES = {
    open:          'bg-sky-100 text-sky-800 ring-sky-200',
    in_progress:   'bg-blue-100 text-blue-800 ring-blue-200',
    investigating: 'bg-violet-100 text-violet-800 ring-violet-200',
    escalated:     'bg-red-100 text-red-800 ring-red-200',
    resolved:      'bg-emerald-100 text-emerald-800 ring-emerald-200',
    closed:        'bg-slate-200 text-slate-700 ring-slate-300',
    ignored:       'bg-slate-100 text-slate-600 ring-slate-200',
};

export function IssueStatusPill({ label }) {
    const cls = STATUS_STYLES[label] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 ${cls}`}>
            {String(label ?? '?').replace(/_/g, ' ')}
        </span>
    );
}

export function IssueSeverityPill({ label }) {
    const cls = SEVERITY_STYLES[label] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 capitalize ${cls}`}>
            {label ?? '?'}
        </span>
    );
}

export default function IssuesPage() {
    const dispatch = useDispatch();
    const list    = useSelector(selectIssues);
    const meta    = useSelector(selectIssuesMeta);
    const loading = useSelector(selectIssuesLoading);
    const stats   = useSelector(selectIssueStats);

    const [filters,  setFilters]  = useState({ open_only: true });
    const [page,     setPage]     = useState(1);
    const [selected, setSelected] = useState(new Set());
    const [bulk,     setBulk]     = useState(null);  // 'close' | 'reclassify'

    useEffect(() => { dispatch(fetchIssues({ ...filters, page, per_page: 50 })); }, [dispatch, filters, page]);
    useEffect(() => { dispatch(fetchIssueStats()); }, [dispatch]);

    const toggleAll = () => {
        if (selected.size === list.length) setSelected(new Set());
        else setSelected(new Set(list.map((i) => i.id)));
    };

    return (
        <div className="p-6 space-y-4">
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                        <Bug size={22} /> Issues
                    </h1>
                    <p className="text-sm text-slate-600">
                        Cross-tenant security issues. Transitions follow the customer-side state machine (Issue::ALLOWED_TRANSITIONS).
                    </p>
                </div>
                {selected.size > 0 && (
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setBulk('close')}
                            className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-md">
                            Bulk close ({selected.size})
                        </button>
                        <button type="button" onClick={() => setBulk('reclassify')}
                            className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-md">
                            Bulk reclassify ({selected.size})
                        </button>
                    </div>
                )}
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Open total"     value={stats?.open_total ?? '—'} />
                <Stat label="Total"          value={stats?.total      ?? '—'} />
                <Stat label="SLA breached"   value={stats?.sla_breached ?? '—'}
                      tone={(stats?.sla_breached ?? 0) > 0 ? 'critical' : 'default'} />
                <Stat label="Critical (any state)" value={stats?.by_severity?.critical ?? 0} />
            </div>

            <AdminFilterBar
                filters={[
                    { key: 'search',    type: 'text',   label: 'Search', placeholder: 'Title, asset, CWE…' },
                    { key: 'status',    type: 'select', label: 'Status',   options: STATUS_OPTIONS },
                    { key: 'severity',  type: 'select', label: 'Severity', options: SEVERITY_OPTIONS },
                    { key: 'type',      type: 'text',   label: 'Type' },
                    { key: 'open_only', type: 'boolean', label: 'Open only' },
                    { key: 'sla_breached_only', type: 'boolean', label: 'SLA breached' },
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
                                        ? <CheckSquare size={14} /> : <Square size={14} />}
                                </button>
                            </th>
                            <th className="px-3 py-2 text-left">Issue</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Company</th>
                            <th className="px-3 py-2 text-left">Severity</th>
                            <th className="px-3 py-2 text-left">Status</th>
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
                            <tr><td colSpan="8" className="px-3 py-8 text-center text-slate-500">No issues match.</td></tr>
                        ) : list.map((i) => (
                            <tr key={i.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2.5">
                                    <button type="button" onClick={() => {
                                        const n = new Set(selected);
                                        n.has(i.id) ? n.delete(i.id) : n.add(i.id);
                                        setSelected(n);
                                    }} className="text-slate-400 hover:text-slate-700">
                                        {selected.has(i.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                                    </button>
                                </td>
                                <td className="px-3 py-2.5">
                                    <div className="font-medium text-slate-900">{i.title}</div>
                                    {i.asset && <div className="text-xs text-slate-500 truncate max-w-md"><code>{i.asset}</code></div>}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-700">
                                    {i.type}{i.sub_type && <span className="text-slate-500"> / {i.sub_type}</span>}
                                </td>
                                <td className="px-3 py-2.5">
                                    <Link to={`/companies/${i.company_id}?tab=issues`} className="text-xs font-mono text-slate-700 hover:underline">
                                        {i.company_id}
                                    </Link>
                                </td>
                                <td className="px-3 py-2.5"><IssueSeverityPill label={i.severity_label} /></td>
                                <td className="px-3 py-2.5"><IssueStatusPill label={i.status_label} /></td>
                                <td className="px-3 py-2.5">
                                    {i.sla_due ? (
                                        <span className={`inline-flex items-center gap-1 text-xs ${i.sla_breached ? 'text-red-700 font-semibold' : 'text-slate-600'}`}>
                                            <Clock size={11} className={i.sla_breached ? '' : 'text-slate-400'} />
                                            {formatDistanceToNow(parseISO(i.sla_due), { addSuffix: true })}
                                        </span>
                                    ) : <span className="text-xs text-slate-400">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">
                                    {i.created_at ? formatDistanceToNow(parseISO(i.created_at), { addSuffix: true }) : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {meta && meta.last_page > 1 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-sm">
                        <div className="text-slate-600">Page {meta.current_page} of {meta.last_page} · {meta.total} issues</div>
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

            {bulk === 'close' && (
                <BulkCloseModal selected={selected}
                    onClose={() => setBulk(null)}
                    onConfirm={async (reason) => {
                        await dispatch(bulkCloseIssues({ issueIds: Array.from(selected), reason }));
                        setBulk(null); setSelected(new Set());
                        dispatch(fetchIssues({ ...filters, page, per_page: 50 }));
                    }} />
            )}
            {bulk === 'reclassify' && (
                <BulkReclassifyModal selected={selected}
                    onClose={() => setBulk(null)}
                    onConfirm={async (severity, reason) => {
                        await dispatch(bulkReclassifyIssues({ issueIds: Array.from(selected), severity, reason }));
                        setBulk(null); setSelected(new Set());
                        dispatch(fetchIssues({ ...filters, page, per_page: 50 }));
                    }} />
            )}
        </div>
    );
}

function BulkCloseModal({ selected, onClose, onConfirm }) {
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    return (
        <BulkModal title={`Close ${selected.size} issues`} onClose={onClose}
            footer={<>
                <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-700">Cancel</button>
                <button type="button" disabled={reason.length < 5 || busy}
                    onClick={async () => { setBusy(true); try { await onConfirm(reason); } finally { setBusy(false); } }}
                    className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 text-white rounded-md disabled:opacity-50">
                    {busy ? 'Closing…' : 'Close issues'}
                </button>
            </>}>
            <p className="text-xs text-slate-500 mb-3">
                Issues whose current state doesn't allow closing will be skipped (state machine enforced).
            </p>
            <label className="block text-xs font-medium text-slate-700 mb-1">Reason (≥5 chars)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                className="w-full p-2 text-sm border border-slate-300 rounded-md" />
        </BulkModal>
    );
}

function BulkReclassifyModal({ selected, onClose, onConfirm }) {
    const [severity, setSeverity] = useState('medium');
    const [reason,   setReason]   = useState('');
    const [busy,     setBusy]     = useState(false);
    return (
        <BulkModal title={`Reclassify ${selected.size} issues`} onClose={onClose}
            footer={<>
                <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-700">Cancel</button>
                <button type="button" disabled={reason.length < 5 || busy}
                    onClick={async () => { setBusy(true); try { await onConfirm(severity, reason); } finally { setBusy(false); } }}
                    className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 text-white rounded-md disabled:opacity-50">
                    {busy ? 'Reclassifying…' : 'Reclassify'}
                </button>
            </>}>
            <label className="block text-xs font-medium text-slate-700 mb-1">New severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}
                className="w-full p-2 text-sm border border-slate-300 rounded-md mb-3">
                {SEVERITY_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <label className="block text-xs font-medium text-slate-700 mb-1">Reason (≥5 chars)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                className="w-full p-2 text-sm border border-slate-300 rounded-md" />
        </BulkModal>
    );
}

function BulkModal({ title, children, footer, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold">{title}</h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="p-5">{children}</div>
                <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">{footer}</div>
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
