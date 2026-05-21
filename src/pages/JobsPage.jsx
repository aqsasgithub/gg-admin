import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Briefcase, AlertOctagon, Loader2, RotateCcw, Trash2, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
    fetchJobSummary, fetchFailedJobs, retryFailedJob, forgetFailedJob, retryAllFailedJobs,
    selectJobSummary, selectFailedJobs, selectFailedJobsMeta, selectJobsLoading,
} from '../features/admin/adminJobsSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';

export default function JobsPage() {
    const dispatch = useDispatch();
    const summary = useSelector(selectJobSummary);
    const list    = useSelector(selectFailedJobs);
    const meta    = useSelector(selectFailedJobsMeta);
    const loading = useSelector(selectJobsLoading);

    const [filters, setFilters] = useState({});
    const [page,    setPage]    = useState(1);
    const [confirm, setConfirm] = useState(null);
    const [details, setDetails] = useState(null);

    useEffect(() => { dispatch(fetchJobSummary()); }, [dispatch]);
    useEffect(() => { dispatch(fetchFailedJobs({ ...filters, page, per_page: 100 })); }, [dispatch, filters, page]);

    return (
        <div className="p-6 space-y-4">
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy">Background jobs</h1>
                    <p className="text-sm text-slate-600">
                        Queue depth, failed job inspection, and retry. For Horizon dashboards, this complements rather than replaces.
                    </p>
                </div>
                <button type="button" onClick={() => { dispatch(fetchJobSummary()); dispatch(fetchFailedJobs({ ...filters, page, per_page: 100 })); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50">
                    <RefreshCw size={12} /> Refresh
                </button>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Stat icon={Briefcase}    label="Pending jobs" value={summary?.pending ?? '—'} />
                <Stat icon={AlertOctagon} label="Failed jobs"  value={summary?.failed  ?? '—'} tone={summary?.failed ? 'critical' : 'default'} />
                <Stat icon={Briefcase}    label="Oldest pending"
                    value={summary?.oldest_pending?.available_at ? format(new Date(summary.oldest_pending.available_at * 1000), 'HH:mm:ss') : '—'} />
            </div>

            {summary?.failed > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-red-50 border border-red-200 rounded text-sm">
                    <span className="text-red-900">{summary.failed} failed jobs in queue.</span>
                    <button type="button" onClick={() => setConfirm({ type: 'retry-all' })}
                        className="px-2 py-1 text-xs bg-white border border-red-300 hover:bg-red-50 rounded text-red-700">
                        Retry all
                    </button>
                </div>
            )}

            <AdminFilterBar
                filters={[
                    { key: 'queue', type: 'text', label: 'Queue', placeholder: 'default, high, scans...' },
                    { key: 'class', type: 'text', label: 'Job class', placeholder: 'App\\Jobs\\...' },
                ]}
                value={filters}
                onChange={(v) => { setFilters(v); setPage(1); }}
                onClear={() => { setFilters({}); setPage(1); }}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Job class</th>
                            <th className="px-3 py-2 text-left">Queue</th>
                            <th className="px-3 py-2 text-left">Failed at</th>
                            <th className="px-3 py-2 text-left">Exception</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !list.length ? (
                            <tr><td colSpan="5" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="5" className="px-3 py-8 text-center text-slate-500">No failed jobs.</td></tr>
                        ) : list.map((j) => (
                            <tr key={j.id}>
                                <td className="px-3 py-2.5 text-xs font-mono">
                                    <button type="button" onClick={() => setDetails(j)} className="hover:underline">
                                        {j.job_class ?? <span className="italic text-slate-400">unknown</span>}
                                    </button>
                                </td>
                                <td className="px-3 py-2.5 text-xs">{j.queue ?? '—'}</td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">{j.failed_at ?? '—'}</td>
                                <td className="px-3 py-2.5 text-xs text-red-700 max-w-md truncate" title={j.exception_summary}>
                                    {j.exception_summary}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                    <div className="flex justify-end gap-1">
                                        <button type="button" onClick={() => setConfirm({ type: 'retry', job: j })}
                                            className="p-1.5 rounded hover:bg-slate-100 text-guardian-navy" title="Retry">
                                            <RotateCcw size={12} />
                                        </button>
                                        <button type="button" onClick={() => setConfirm({ type: 'forget', job: j })}
                                            className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Forget">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {meta && meta.last_page > 1 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-sm">
                        <div className="text-slate-600">Page {meta.current_page} of {meta.last_page} · {meta.total} failures</div>
                        <div className="flex gap-1">
                            <button type="button" disabled={meta.current_page <= 1} onClick={() => setPage(meta.current_page - 1)}
                                className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40">Previous</button>
                            <button type="button" disabled={meta.current_page >= meta.last_page} onClick={() => setPage(meta.current_page + 1)}
                                className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40">Next</button>
                        </div>
                    </div>
                )}
            </div>

            {details && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-3xl bg-white rounded-lg shadow-xl">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-base font-semibold font-mono truncate">{details.job_class}</h3>
                            <button type="button" onClick={() => setDetails(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                        </div>
                        <div className="p-5 max-h-96 overflow-y-auto text-xs">
                            <pre className="bg-slate-50 p-3 rounded border border-slate-200 whitespace-pre-wrap break-all">
                                {details.exception_summary}
                            </pre>
                        </div>
                    </div>
                </div>
            )}

            <AdminConfirmModal open={confirm?.type === 'retry'}
                title={`Retry job ${confirm?.job?.id}?`}
                description="Job is requeued. The original failure record is removed."
                confirmLabel="Retry"
                onCancel={() => setConfirm(null)}
                onConfirm={async () => {
                    await dispatch(retryFailedJob(confirm.job.id));
                    setConfirm(null);
                    dispatch(fetchJobSummary());
                }} />
            <AdminConfirmModal open={confirm?.type === 'forget'}
                title={`Forget job ${confirm?.job?.id}?`}
                description="Job is permanently removed from the failed queue."
                confirmLabel="Forget" variant="destructive"
                onCancel={() => setConfirm(null)}
                onConfirm={async () => {
                    await dispatch(forgetFailedJob(confirm.job.id));
                    setConfirm(null);
                }} />
            <AdminConfirmModal open={confirm?.type === 'retry-all'}
                title="Retry all failed jobs?"
                description={`This requeues every failed job (${summary?.failed ?? 0} jobs). Use sparingly.`}
                confirmLabel="Retry all" variant="warning"
                onCancel={() => setConfirm(null)}
                onConfirm={async () => {
                    await dispatch(retryAllFailedJobs(filters.queue || null));
                    setConfirm(null);
                    dispatch(fetchJobSummary());
                    dispatch(fetchFailedJobs({ ...filters, page, per_page: 100 }));
                }} />
        </div>
    );
}

function Stat({ icon: Icon, label, value, tone = 'default' }) {
    const tones = { critical: 'text-red-600', default: 'text-guardian-navy' };
    return (
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Icon size={12} /> {label}
            </div>
            <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
        </div>
    );
}
