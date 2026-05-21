import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { ScanLine, AlertCircle, Loader2, Activity } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchScans, fetchScanStats,
    selectScans, selectScansMeta, selectScansLoading, selectScanStats,
} from '../features/admin/adminScansSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';

const STATUS_OPTIONS = [
    { value: 'in_progress', label: 'In progress' },
    { value: 'completed',   label: 'Completed' },
    { value: 'failed',      label: 'Failed' },
];

const STATUS_STYLES = {
    in_progress: 'bg-blue-100 text-blue-800 ring-blue-200',
    completed:   'bg-emerald-100 text-emerald-800 ring-emerald-200',
    failed:      'bg-red-100 text-red-800 ring-red-200',
};

export function ScanStatusPill({ status }) {
    const cls = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 ${cls}`}>
            {String(status ?? 'unknown').replace(/_/g, ' ')}
        </span>
    );
}

export default function ScansPage() {
    const dispatch = useDispatch();
    const list    = useSelector(selectScans);
    const meta    = useSelector(selectScansMeta);
    const loading = useSelector(selectScansLoading);
    const stats   = useSelector(selectScanStats);

    const [filters, setFilters] = useState({});
    const [page,    setPage]    = useState(1);

    useEffect(() => { dispatch(fetchScans({ ...filters, page, per_page: 50 })); }, [dispatch, filters, page]);
    useEffect(() => { dispatch(fetchScanStats({ window_days: 7 })); }, [dispatch]);

    return (
        <div className="p-6 space-y-4">
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                        <ScanLine size={22} /> Scans
                    </h1>
                    <p className="text-sm text-slate-600">
                        Cross-tenant scan history. The product's scanner pipeline doesn't expose mid-run cancel,
                        but stuck scans can be force-failed via the Scan Control page.
                    </p>
                </div>
                {(stats?.stale_running ?? 0) > 0 && (
                    <Link to="/scan-control"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-50 hover:bg-red-100 text-red-700 rounded-md">
                        <AlertCircle size={14} /> {stats.stale_running} stuck — view scan control
                    </Link>
                )}
            </header>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat label="Total (7d)"            value={stats?.total_in_window ?? '—'} />
                <Stat label="Failed (7d)"           value={stats?.failed_in_window ?? '—'}
                      tone={(stats?.failure_rate_pct ?? 0) > 10 ? 'critical' : 'default'} />
                <Stat label="Failure rate"          value={stats?.failure_rate_pct != null ? `${stats.failure_rate_pct}%` : '—'} />
                <Stat label="Still running"         value={stats?.still_running ?? '—'} />
                <Stat label="Median duration (s)"   value={stats?.median_duration_s ?? '—'} />
            </div>

            <AdminFilterBar
                filters={[
                    { key: 'search',         type: 'text',   label: 'Search', placeholder: 'Scan ID, error…' },
                    { key: 'status',         type: 'select', label: 'Status',  options: STATUS_OPTIONS },
                    { key: 'scan_type',      type: 'text',   label: 'Scan type' },
                    { key: 'scan_sub_type',  type: 'text',   label: 'Sub-type' },
                    { key: 'failed_only',    type: 'boolean', label: 'Failed only' },
                ]}
                value={filters}
                onChange={(v) => { setFilters(v); setPage(1); }}
                onClear={() => { setFilters({}); setPage(1); }}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Scan</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Company</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-right">Issues</th>
                            <th className="px-3 py-2 text-right">Duration (s)</th>
                            <th className="px-3 py-2 text-left">Started</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !list.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">No scans match.</td></tr>
                        ) : list.map((s) => (
                            <tr key={s.id}>
                                <td className="px-3 py-2.5">
                                    <Link to={`/scans/${s.id}`} className="font-mono text-xs text-guardian-navy hover:underline">
                                        {s.id}
                                    </Link>
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-700">
                                    {s.scan_type}{s.scan_sub_type && <span className="text-slate-500"> / {s.scan_sub_type}</span>}
                                </td>
                                <td className="px-3 py-2.5">
                                    <Link to={`/companies/${s.company_id}?tab=scans`} className="text-xs font-mono text-slate-700 hover:underline">
                                        {s.company_id}
                                    </Link>
                                </td>
                                <td className="px-3 py-2.5"><ScanStatusPill status={s.status} /></td>
                                <td className="px-3 py-2.5 text-right text-xs">
                                    {s.issues_found}
                                    {s.critical_issues > 0 && <span className="ml-1 text-red-700 font-medium">({s.critical_issues}c)</span>}
                                </td>
                                <td className="px-3 py-2.5 text-right text-xs font-mono">{s.duration_seconds ?? '—'}</td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">
                                    {s.started_at ? formatDistanceToNow(parseISO(s.started_at), { addSuffix: true }) : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {meta && meta.last_page > 1 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-sm">
                        <div className="text-slate-600">Page {meta.current_page} of {meta.last_page} · {meta.total} scans</div>
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
