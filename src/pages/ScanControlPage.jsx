import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
    Power, AlertCircle, Clock, Loader2, XCircle, Building2,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchStuckScans, markScanFailed,
    selectStuckScans, selectScanControlLoading,
} from '../features/admin/adminScanControlSlice';

/**
 * Operational view for scan control:
 *   - "Stuck scans" — in_progress for >N hours, candidates for force-fail
 *   - Per-tenant scan control is managed on each Company detail page's
 *     Scans tab (CompanyScanControlPanel inside CompanyScansTab)
 */
export default function ScanControlPage() {
    const dispatch = useDispatch();
    const stuck    = useSelector(selectStuckScans);
    const loading  = useSelector(selectScanControlLoading);

    const [hours,    setHours]    = useState(2);
    const [failing,  setFailing]  = useState(null);

    useEffect(() => { dispatch(fetchStuckScans({ hours })); }, [dispatch, hours]);

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                    <Power size={22} /> Scan control
                </h1>
                <p className="text-sm text-slate-600">
                    Stuck scans + recovery actions. Per-tenant scan policy (freeze, block modules, quotas, concurrency limits)
                    is managed on each Company's Scans tab.
                </p>
            </header>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900 space-y-2">
                <p>
                    <strong>Worker state taxonomy.</strong> The DB <code>status</code> column reflects what the
                    application <em>thinks</em> is happening, not necessarily what is. A row can be:
                </p>
                <ul className="ml-4 list-disc text-xs space-y-0.5">
                    <li><code>queued</code>     — job dispatched but not yet picked up by a worker</li>
                    <li><code>in_progress</code> — a worker claimed it; <em>may still be running, or may be zombie</em></li>
                    <li><code>stale</code>     — <code>in_progress</code> for &gt; N hours (this list)</li>
                    <li><code>failed</code>    — terminal; cleared from concurrency caps</li>
                    <li><code>completed</code> — terminal; result persisted</li>
                </ul>
                <p>
                    <strong>"Mark failed" only writes to the DB.</strong> It clears the row's concurrency lock so the tenant
                    can dispatch new scans, and removes it from operational dashboards. It does <strong>not</strong> terminate
                    a running worker process — the product's scanner pipeline has no mid-run cancellation primitive (yet).
                    If a worker is still alive, it will keep running until it finishes naturally and may overwrite the row
                    back to <code>completed</code>.
                </p>
            </div>

            <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-slate-700">In progress for at least</label>
                <select value={hours} onChange={(e) => setHours(parseInt(e.target.value, 10))}
                    className="px-2 py-1 text-sm border border-slate-300 rounded-md">
                    <option value="1">1 hour</option>
                    <option value="2">2 hours</option>
                    <option value="4">4 hours</option>
                    <option value="12">12 hours</option>
                    <option value="24">24 hours</option>
                </select>
                <button type="button" onClick={() => dispatch(fetchStuckScans({ hours }))}
                    className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-md">Refresh</button>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Scan</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Company</th>
                            <th className="px-3 py-2 text-left">Started</th>
                            <th className="px-3 py-2 text-left">Age</th>
                            <th className="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !stuck.length ? (
                            <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !stuck.length ? (
                            <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">
                                No stuck scans. The scanner pipeline is healthy.
                            </td></tr>
                        ) : stuck.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2.5">
                                    <Link to={`/scans/${s.id}`} className="font-mono text-xs text-guardian-navy hover:underline">
                                        {s.id}
                                    </Link>
                                </td>
                                <td className="px-3 py-2.5 text-xs">
                                    {s.scan_type}{s.scan_sub_type && <span className="text-slate-500"> / {s.scan_sub_type}</span>}
                                </td>
                                <td className="px-3 py-2.5">
                                    <Link to={`/companies/${s.company_id}`}
                                        className="inline-flex items-center gap-1 text-xs font-mono text-slate-700 hover:underline">
                                        <Building2 size={11} /> {s.company_id}
                                    </Link>
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">
                                    {s.started_at ? formatDistanceToNow(parseISO(s.started_at), { addSuffix: true }) : '—'}
                                </td>
                                <td className="px-3 py-2.5">
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                                        <Clock size={11} /> {s.age_hours}h
                                    </span>
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                    <button type="button" onClick={() => setFailing(s)}
                                        title="Marks the DB row as failed. Does NOT kill a running worker."
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-700 rounded-md">
                                        <XCircle size={11} /> Mark failed (DB)
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {failing && (
                <ForceFailModal scan={failing} onClose={() => setFailing(null)}
                    onConfirm={async (reason) => {
                        await dispatch(markScanFailed({ scanId: failing.id, reason }));
                        setFailing(null);
                    }} />
            )}
        </div>
    );
}

function ForceFailModal({ scan, onClose, onConfirm }) {
    const [reason, setReason] = useState('');
    const [busy,   setBusy]   = useState(false);
    const valid = reason.length >= 5;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold flex items-center gap-2"><AlertCircle size={16} className="text-red-600" /> Mark scan failed (DB only)</h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="p-5">
                    <p className="text-sm text-slate-700 mb-2">
                        Mark scan <code className="font-mono">{scan.id}</code> as <strong>failed</strong> in the database.
                    </p>
                    <p className="text-xs text-slate-500 mb-3">
                        <strong>This does not kill a running worker.</strong> It clears the concurrency lock so the tenant
                        can dispatch new scans. If a worker process is still alive, it will keep running and may overwrite
                        this row back to <code>completed</code> when it finishes. Use this when a worker has died or a job
                        is genuinely stale — not as a "stop this scan now" button.
                    </p>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Reason (≥5 chars, audited)</label>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                        className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                </div>
                <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-700">Cancel</button>
                    <button type="button" disabled={!valid || busy}
                        onClick={async () => { setBusy(true); try { await onConfirm(reason); } finally { setBusy(false); } }}
                        className="px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50">
                        {busy ? 'Marking failed…' : 'Mark failed (DB)'}
                    </button>
                </div>
            </div>
        </div>
    );
}
