import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ScanLine, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fetchScan, selectScan } from '../features/admin/adminScansSlice';
import { ScanStatusPill } from './ScansPage';

export default function ScanDetailPage() {
    const { id } = useParams();
    const dispatch = useDispatch();
    const detail = useSelector((s) => selectScan(s, id));

    useEffect(() => { dispatch(fetchScan(id)); }, [dispatch, id]);

    if (!detail) {
        return (
            <div className="p-6 text-center text-slate-500">
                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
            </div>
        );
    }

    const s = detail.scan;
    const prev = detail.previous;

    return (
        <div className="p-6 space-y-4">
            <div>
                <Link to="/scans" className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
                    <ArrowLeft size={14} /> Back to scans
                </Link>
            </div>

            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                        <ScanLine size={20} /> Scan <code className="font-mono text-base">{s.id}</code>
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                        {s.scan_type}{s.scan_sub_type && ` · ${s.scan_sub_type}`}
                        {' · '}
                        <Link to={`/companies/${s.company_id}?tab=scans`} className="hover:underline">{s.company_id}</Link>
                    </p>
                </div>
                <ScanStatusPill status={s.status} />
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Timing">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <KV label="Started"     value={s.started_at ? format(parseISO(s.started_at), 'PPpp') : '—'} />
                        <KV label="Completed"   value={s.completed_at ? format(parseISO(s.completed_at), 'PPpp') : '—'} />
                        <KV label="Duration (s)" value={s.duration_seconds ?? '—'} />
                    </dl>
                </Card>

                <Card title="Findings">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <KV label="Total issues"    value={s.issues_found ?? 0} />
                        <KV label="Critical"        value={<span className="text-red-700 font-semibold">{s.critical_issues}</span>} />
                        <KV label="High"            value={<span className="text-orange-700 font-semibold">{s.high_issues}</span>} />
                        <KV label="Medium"          value={s.medium_issues} />
                        <KV label="Low"             value={s.low_issues} />
                    </dl>
                </Card>

                {prev && (
                    <Card title="Compared to previous scan">
                        <p className="text-xs text-slate-500 mb-2">
                            Previous: <code>{prev.id}</code> — completed {prev.completed_at ? format(parseISO(prev.completed_at), 'MMM d, HH:mm') : '—'}
                        </p>
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <KV label="Δ Issues"
                                value={<Delta from={prev.issues_found} to={s.issues_found} />} />
                            <KV label="Δ Critical"
                                value={<Delta from={prev.critical_issues} to={s.critical_issues} />} />
                        </dl>
                    </Card>
                )}

                {s.error_message && (
                    <Card title="Error">
                        <pre className="text-xs bg-red-50 text-red-900 rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap">
                            {s.error_message}
                        </pre>
                    </Card>
                )}

                {s.results_summary && (
                    <Card title="Results summary">
                        <pre className="text-xs bg-slate-50 rounded p-2 overflow-x-auto max-h-64">
                            {typeof s.results_summary === 'string' ? s.results_summary : JSON.stringify(s.results_summary, null, 2)}
                        </pre>
                    </Card>
                )}

                {s.scan_metadata && (
                    <Card title="Metadata">
                        <pre className="text-xs bg-slate-50 rounded p-2 overflow-x-auto max-h-64">
                            {typeof s.scan_metadata === 'string' ? s.scan_metadata : JSON.stringify(s.scan_metadata, null, 2)}
                        </pre>
                    </Card>
                )}
            </div>
        </div>
    );
}

function Delta({ from, to }) {
    const diff = (to ?? 0) - (from ?? 0);
    if (diff === 0) return <span className="text-slate-500">no change</span>;
    return diff > 0
        ? <span className="text-red-700 font-semibold">+{diff}</span>
        : <span className="text-emerald-700 font-semibold">{diff}</span>;
}

function Card({ title, children }) {
    return (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">{title}</div>
            <div className="p-3">{children}</div>
        </div>
    );
}

function KV({ label, value }) {
    return (
        <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="text-sm text-slate-800">{value}</dd>
        </div>
    );
}
