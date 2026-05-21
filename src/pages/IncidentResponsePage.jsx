import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Shield, AlertOctagon, UserX, PauseCircle, PlayCircle, LogOut, Loader2 } from 'lucide-react';
import {
    fetchIncidentStatus, forceLogoutAll, endAllImpersonations,
    suspendAllCompanies, freezeScans, unfreezeScans,
    selectIncidentStatus, selectIncidentLoading,
} from '../features/admin/adminIncidentSlice';

/**
 * Break-glass admin actions. These are extreme controls — every action
 * here either logs everyone out, kills active sessions, halts scans
 * platform-wide, or mass-suspends tenants. Use only in genuine
 * incident response.
 *
 * Each action requires a typed reason. The "suspend all" requires
 * the literal string "SUSPEND ALL" to be typed before submission.
 */
export default function IncidentResponsePage() {
    const dispatch = useDispatch();
    const status  = useSelector(selectIncidentStatus);
    const loading = useSelector(selectIncidentLoading);

    const [modal, setModal] = useState(null);

    useEffect(() => { dispatch(fetchIncidentStatus()); }, [dispatch]);

    return (
        <div className="p-6 space-y-4 max-w-5xl">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                    <Shield size={22} className="text-red-600" /> Incident response
                </h1>
                <p className="text-sm text-slate-600">
                    Platform-wide kill switches. Every action here is destructive in scope and
                    irreversibly logged. Use only when responding to an active incident.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Stat label="Platform scan state"
                    value={status?.scans_frozen ? 'FROZEN' : 'Normal'}
                    tone={status?.scans_frozen ? 'critical' : 'success'} />
                <Stat label="Active impersonations"
                    value={status?.active_impersonations ?? '—'}
                    tone={status?.active_impersonations ? 'warning' : 'default'} />
                <Stat label="Suspended companies"
                    value={status?.suspended_companies ?? '—'} />
            </div>

            {loading && !status && (
                <div className="p-6 text-center text-slate-500">
                    <Loader2 size={18} className="inline animate-spin mr-2" /> Loading state…
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                <ActionCard icon={LogOut} title="Force-logout every session" tone="critical"
                    description="Invalidates every JWT issued before now. All users (including admins) will need to re-login. Used when a session-related compromise is suspected."
                    buttonLabel="Force-logout all"
                    onClick={() => setModal({ type: 'logout' })} />

                <ActionCard icon={UserX} title="End all impersonation sessions" tone="warning"
                    description="Terminates every active 'login as customer' session. Used when an impersonation is detected as misuse."
                    buttonLabel="End all sessions"
                    onClick={() => setModal({ type: 'end-imp' })} />

                <ActionCard icon={status?.scans_frozen ? PlayCircle : PauseCircle}
                    title={status?.scans_frozen ? 'Unfreeze scans' : 'Freeze all scans'}
                    tone={status?.scans_frozen ? 'success' : 'warning'}
                    description={status?.scans_frozen
                        ? 'Resume normal scan processing platform-wide.'
                        : 'Prevent any new scans from starting (existing scans continue). Used when a scanner is misbehaving or to reduce load.'}
                    buttonLabel={status?.scans_frozen ? 'Unfreeze' : 'Freeze scans'}
                    onClick={() => setModal({ type: status?.scans_frozen ? 'unfreeze' : 'freeze' })} />

                <ActionCard icon={AlertOctagon} title="Mass-suspend tenants" tone="critical"
                    description="Suspends every company license. Customer logins for affected tenants will be blocked. Used in severe billing-system compromise scenarios. EXTRA confirmation required."
                    buttonLabel="Mass-suspend"
                    onClick={() => setModal({ type: 'suspend-all' })} />
            </div>

            <ReasonModal open={modal?.type === 'logout'}
                title="Force-logout every active session?"
                warning="Every user, including all admins, will need to log in again. This is a major user-facing action."
                onCancel={() => setModal(null)}
                onConfirm={async (reason) => {
                    await dispatch(forceLogoutAll(reason));
                    setModal(null);
                }} />

            <ReasonModal open={modal?.type === 'end-imp'}
                title="End all active impersonation sessions?"
                warning={`${status?.active_impersonations ?? 0} sessions will be terminated immediately.`}
                onCancel={() => setModal(null)}
                onConfirm={async (reason) => {
                    await dispatch(endAllImpersonations(reason));
                    setModal(null);
                }} />

            <ReasonModal open={modal?.type === 'freeze'}
                title="Freeze all scans platform-wide?"
                warning="New scans will be rejected until you unfreeze. Existing in-flight scans continue."
                onCancel={() => setModal(null)}
                onConfirm={async (reason) => {
                    await dispatch(freezeScans(reason));
                    setModal(null);
                }} />

            <ReasonModal open={modal?.type === 'unfreeze'}
                title="Unfreeze scans?"
                warning="Normal scan processing resumes immediately. No reason required but recommended."
                onCancel={() => setModal(null)}
                requireReason={false}
                onConfirm={async () => {
                    await dispatch(unfreezeScans());
                    setModal(null);
                }} />

            <SuspendAllModal open={modal?.type === 'suspend-all'}
                onCancel={() => setModal(null)}
                onConfirm={async ({ reason, excluded }) => {
                    await dispatch(suspendAllCompanies({ reason, confirm: 'SUSPEND ALL', excludeCompanyIds: excluded }));
                    setModal(null);
                }} />
        </div>
    );
}

function Stat({ label, value, tone = 'default' }) {
    const tones = { critical: 'text-red-600', warning: 'text-amber-700', success: 'text-emerald-700', default: 'text-guardian-navy' };
    return (
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
        </div>
    );
}

function ActionCard({ icon: Icon, title, description, tone, buttonLabel, onClick }) {
    const border = tone === 'critical' ? 'border-red-200 bg-red-50/50'
                 : tone === 'warning' ? 'border-amber-200 bg-amber-50/50'
                 : 'border-slate-200 bg-white';
    const btn = tone === 'critical' ? 'bg-red-600 hover:bg-red-700'
              : tone === 'warning' ? 'bg-amber-600 hover:bg-amber-700'
              : tone === 'success' ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-guardian-navy hover:bg-guardian-navy-800';

    return (
        <div className={`p-5 border rounded-lg ${border}`}>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-2">
                <Icon size={14} /> {title}
            </h3>
            <p className="text-sm text-slate-700 mb-4">{description}</p>
            <button type="button" onClick={onClick}
                className={`px-3 py-1.5 text-sm font-medium text-white rounded-md ${btn}`}>
                {buttonLabel}
            </button>
        </div>
    );
}

function ReasonModal({ open, title, warning, requireReason = true, onCancel, onConfirm }) {
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    if (!open) return null;
    const ok = !requireReason || reason.trim().length >= 5;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold">{title}</h3>
                    <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="p-5 space-y-3">
                    <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-900">
                        {warning}
                    </div>
                    {requireReason && (
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Reason (required, &gt;=5 chars)</label>
                            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                                className="w-full text-sm p-2 border border-slate-300 rounded-md" />
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm">Cancel</button>
                        <button type="button" disabled={!ok || busy}
                            onClick={async () => { setBusy(true); try { await onConfirm(reason.trim()); } finally { setBusy(false); } }}
                            className="px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-md">
                            {busy ? 'Working…' : 'Confirm'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SuspendAllModal({ open, onCancel, onConfirm }) {
    const [reason, setReason] = useState('');
    const [confirm, setConfirm] = useState('');
    const [excluded, setExcluded] = useState('');
    const [busy, setBusy] = useState(false);
    if (!open) return null;
    const ok = reason.trim().length >= 5 && confirm === 'SUSPEND ALL';
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold">Mass-suspend every tenant?</h3>
                    <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="p-5 space-y-3">
                    <div className="px-3 py-2 bg-red-100 border border-red-300 rounded text-xs text-red-900">
                        EVERY active company license will be set to <code className="bg-white px-1 rounded">suspended</code>.
                        Customer logins block until you reinstate each one. There is no bulk un-suspend.
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Reason *</label>
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                            className="w-full text-sm p-2 border border-slate-300 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Exclude company IDs (comma-separated, optional)</label>
                        <input value={excluded} onChange={(e) => setExcluded(e.target.value)} placeholder="cmp_xxx, cmp_yyy"
                            className="w-full p-2 text-sm font-mono border border-slate-300 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                            Type <code className="bg-slate-100 px-1 rounded">SUSPEND ALL</code> to proceed
                        </label>
                        <input value={confirm} onChange={(e) => setConfirm(e.target.value)}
                            className="w-full p-2 text-sm font-mono border border-slate-300 rounded-md" />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm">Cancel</button>
                        <button type="button" disabled={!ok || busy}
                            onClick={async () => {
                                setBusy(true);
                                try {
                                    await onConfirm({
                                        reason: reason.trim(),
                                        excluded: excluded.split(',').map((s) => s.trim()).filter(Boolean),
                                    });
                                } finally { setBusy(false); }
                            }}
                            className="px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-md">
                            {busy ? 'Working…' : 'Suspend everything'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
