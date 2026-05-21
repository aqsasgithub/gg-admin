import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
    ScanLine, Loader2, Power, Snowflake, ShieldOff, AlertCircle, Plus, X,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fetchCompanyScans, selectCompanyScans } from '../../features/admin/adminScansSlice';
import { ScanStatusPill } from '../../pages/ScansPage';
import {
    fetchScanControl, updateScanControl, freezeTenantScans, unfreezeTenantScans,
    blockModule, unblockModule,
    selectScanControl,
} from '../../features/admin/adminScanControlSlice';

export default function CompanyScansTab({ companyId }) {
    const dispatch = useDispatch();
    const scans   = useSelector((s) => selectCompanyScans(s, companyId));
    const control = useSelector((s) => selectScanControl(s, companyId));

    useEffect(() => {
        dispatch(fetchCompanyScans({ companyId, per_page: 50 }));
        dispatch(fetchScanControl(companyId));
    }, [dispatch, companyId]);

    return (
        <div className="space-y-6">
            {/* Scan control plane */}
            <ScanControlPanel companyId={companyId} control={control} />

            {/* Scan history */}
            <section>
                <header className="mb-3">
                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <ScanLine size={16} /> Scan history
                    </h2>
                </header>

                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-3 py-2 text-left">Scan</th>
                                <th className="px-3 py-2 text-left">Type</th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th className="px-3 py-2 text-right">Issues</th>
                                <th className="px-3 py-2 text-right">Duration</th>
                                <th className="px-3 py-2 text-left">Started</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {!scans ? (
                                <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">
                                    <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                                </td></tr>
                            ) : !scans.length ? (
                                <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">No scans for this tenant.</td></tr>
                            ) : scans.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50/50">
                                    <td className="px-3 py-2.5">
                                        <Link to={`/scans/${s.id}`} className="font-mono text-xs text-guardian-navy hover:underline">
                                            {s.id}
                                        </Link>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs">
                                        {s.scan_type}{s.scan_sub_type && <span className="text-slate-500"> / {s.scan_sub_type}</span>}
                                    </td>
                                    <td className="px-3 py-2.5"><ScanStatusPill status={s.status} /></td>
                                    <td className="px-3 py-2.5 text-right text-xs">{s.issues_found}</td>
                                    <td className="px-3 py-2.5 text-right text-xs font-mono">{s.duration_seconds ?? '—'}s</td>
                                    <td className="px-3 py-2.5 text-xs text-slate-500">
                                        {s.started_at ? formatDistanceToNow(parseISO(s.started_at), { addSuffix: true }) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

/**
 * The scan control plane — per-tenant policy.
 *
 *   - Freeze / unfreeze all scans
 *   - Block / unblock specific scan modules (port_scan, security/ssh, etc.)
 *   - Daily scan quota + current count
 *   - Max concurrent scans cap
 */
function ScanControlPanel({ companyId, control }) {
    const dispatch = useDispatch();
    const [editingLimits, setEditingLimits] = useState(false);
    const [moduleToAdd,   setModuleToAdd]   = useState('');
    const [freezing,      setFreezing]      = useState(false);

    if (!control) {
        return (
            <section className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <Loader2 size={14} className="inline animate-spin mr-2 text-slate-500" />
                <span className="text-sm text-slate-500">Loading scan control…</span>
            </section>
        );
    }

    const c = control.control;            // may be null (no row yet)
    const live = control.live ?? {};
    const modules = control.available_modules ?? [];
    const isFrozen = c?.frozen;
    const blockedModules = c?.blocked_modules ?? [];

    return (
        <section className={`border-2 rounded-lg p-4 ${isFrozen ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200'}`}>
            <header className="flex items-start justify-between mb-3">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Power size={16} className={isFrozen ? 'text-red-600' : 'text-slate-600'} />
                        Scan control
                    </h2>
                    <p className="text-sm text-slate-600">
                        Per-tenant scan policy. Enforced by middleware on every customer scan dispatch.
                    </p>
                </div>
                {isFrozen ? (
                    <button type="button" onClick={() => dispatch(unfreezeTenantScans({ companyId }))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white hover:bg-slate-50 border border-red-300 text-red-700 rounded-md">
                        <Snowflake size={14} /> Unfreeze
                    </button>
                ) : (
                    <button type="button" onClick={() => setFreezing(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-100 hover:bg-red-50 hover:text-red-700 rounded-md">
                        <Snowflake size={14} /> Freeze all scans
                    </button>
                )}
            </header>

            {isFrozen && (
                <div className="mb-3 p-2 bg-red-100 border border-red-200 rounded text-sm">
                    <strong className="text-red-900">All scans frozen for this tenant.</strong>
                    {c.frozen_reason && <span className="text-red-800"> Reason: {c.frozen_reason}</span>}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Quotas */}
                <div className="bg-slate-50 rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Limits</h3>
                        <button type="button" onClick={() => setEditingLimits(!editingLimits)}
                            className="text-xs text-guardian-navy hover:underline">
                            {editingLimits ? 'Cancel' : 'Edit'}
                        </button>
                    </div>

                    {editingLimits ? (
                        <LimitsForm c={c} companyId={companyId} onDone={() => setEditingLimits(false)} />
                    ) : (
                        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                            <div>
                                <dt className="text-xs text-slate-500">Daily quota</dt>
                                <dd className="font-mono text-slate-800">
                                    {c?.daily_scan_quota ?? '∞'}
                                    {c?.daily_scan_quota && <span className="text-xs text-slate-500"> · used {c.daily_scan_count ?? 0}</span>}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-slate-500">Max concurrent</dt>
                                <dd className="font-mono text-slate-800">{c?.max_concurrent_scans ?? '∞'}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-slate-500">Currently running</dt>
                                <dd className="font-mono text-slate-800">{live.currently_running_scans ?? 0}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-slate-500">Updated</dt>
                                <dd className="text-xs text-slate-500">
                                    {c?.updated_at ? formatDistanceToNow(parseISO(c.updated_at), { addSuffix: true }) : 'never'}
                                </dd>
                            </div>
                        </dl>
                    )}
                </div>

                {/* Module blocks */}
                <div className="bg-slate-50 rounded-md p-3">
                    <h3 className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">Blocked modules</h3>

                    {blockedModules.length === 0 && (
                        <p className="text-xs text-slate-500 mb-2 italic">No modules blocked. All scan endpoints available to this tenant.</p>
                    )}

                    {blockedModules.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                            {blockedModules.map((m) => (
                                <span key={m} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono bg-red-50 text-red-700 border border-red-200 rounded">
                                    <ShieldOff size={9} /> {m}
                                    <button type="button" onClick={() => dispatch(unblockModule({ companyId, module: m }))}
                                        className="ml-0.5 hover:text-red-900">
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-1">
                        <select value={moduleToAdd} onChange={(e) => setModuleToAdd(e.target.value)}
                            className="flex-1 p-1 text-xs border border-slate-300 rounded">
                            <option value="">Select module to block…</option>
                            {modules.filter((m) => !blockedModules.includes(m)).map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        <button type="button" disabled={!moduleToAdd}
                            onClick={() => {
                                dispatch(blockModule({ companyId, module: moduleToAdd }));
                                setModuleToAdd('');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-slate-200 hover:bg-slate-300 rounded disabled:opacity-40">
                            <Plus size={11} /> Block
                        </button>
                    </div>
                </div>
            </div>

            {freezing && (
                <FreezeModal onClose={() => setFreezing(false)}
                    onConfirm={async (reason) => {
                        await dispatch(freezeTenantScans({ companyId, reason }));
                        setFreezing(false);
                    }} />
            )}
        </section>
    );
}

function LimitsForm({ c, companyId, onDone }) {
    const dispatch = useDispatch();
    const [quota,       setQuota]       = useState(c?.daily_scan_quota ?? '');
    const [concurrent,  setConcurrent]  = useState(c?.max_concurrent_scans ?? '');
    const [notes,       setNotes]       = useState(c?.notes ?? '');
    const [busy,        setBusy]        = useState(false);

    return (
        <form onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
                await dispatch(updateScanControl({
                    companyId,
                    payload: {
                        daily_scan_quota:     quota === '' ? null : parseInt(quota, 10),
                        max_concurrent_scans: concurrent === '' ? null : parseInt(concurrent, 10),
                        notes:                notes || null,
                    },
                }));
                onDone();
            } finally { setBusy(false); }
        }}>
            <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                    <label className="block text-xs text-slate-700 mb-0.5">Daily quota (blank = ∞)</label>
                    <input type="number" min="0" value={quota} onChange={(e) => setQuota(e.target.value)}
                        className="w-full p-1 text-sm border border-slate-300 rounded" />
                </div>
                <div>
                    <label className="block text-xs text-slate-700 mb-0.5">Max concurrent (blank = ∞)</label>
                    <input type="number" min="0" value={concurrent} onChange={(e) => setConcurrent(e.target.value)}
                        className="w-full p-1 text-sm border border-slate-300 rounded" />
                </div>
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="Notes (internal)…"
                className="w-full p-1 text-sm border border-slate-300 rounded mb-2" />
            <button type="submit" disabled={busy}
                className="w-full px-3 py-1 text-xs font-medium bg-guardian-navy hover:bg-guardian-navy-800 text-white rounded disabled:opacity-50">
                {busy ? 'Saving…' : 'Save limits'}
            </button>
        </form>
    );
}

function FreezeModal({ onClose, onConfirm }) {
    const [reason, setReason] = useState('');
    const [busy,   setBusy]   = useState(false);
    const valid = reason.length >= 5;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold flex items-center gap-2"><AlertCircle size={16} className="text-red-600" /> Freeze all scans</h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="p-5">
                    <p className="text-sm text-slate-700 mb-3">
                        Every scan dispatch (UI-initiated and worker job alike) will return 403 until unfrozen.
                        Use for incidents, account-suspension follow-up, or abuse response.
                    </p>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Reason (≥5 chars, shown to tenant)</label>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                        className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                </div>
                <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-700">Cancel</button>
                    <button type="button" disabled={!valid || busy}
                        onClick={async () => { setBusy(true); try { await onConfirm(reason); } finally { setBusy(false); } }}
                        className="px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50">
                        {busy ? 'Freezing…' : 'Freeze scans'}
                    </button>
                </div>
            </div>
        </div>
    );
}
