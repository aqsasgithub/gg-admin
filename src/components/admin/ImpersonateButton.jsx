import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { UserCheck, ExternalLink, Copy, Loader2 } from 'lucide-react';
import {
    startImpersonation, clearLastStarted, selectLastStartedImpersonation,
} from '../../features/admin/adminImpersonationSlice';
import { selectAdminCapabilities } from '../../features/auth/authSlice';

/**
 * Drop into any user row that should support impersonation. Renders
 * nothing if the current admin lacks `impersonation.act`.
 *
 *   <ImpersonateButton user={user} />
 *
 * Opens a modal that requires a reason (>=5 chars) and an optional
 * TTL. On success surfaces the customer-app URL with a "copy + open"
 * action. The token is one-shot — closing this modal forgets it.
 */
export default function ImpersonateButton({ user, size = 'sm' }) {
    const dispatch = useDispatch();
    const caps = useSelector(selectAdminCapabilities);
    const lastStarted = useSelector(selectLastStartedImpersonation);

    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [ttl, setTtl] = useState(15);
    const [busy, setBusy] = useState(false);

    const allowed = caps.includes('*') || caps.includes('impersonation.act');
    if (!allowed) return null;

    const submit = async () => {
        if (!reason.trim() || reason.trim().length < 5) return;
        setBusy(true);
        try {
            await dispatch(startImpersonation({
                userId: user.id, reason: reason.trim(), durationMinutes: ttl,
            }));
        } finally { setBusy(false); }
    };

    const closeModal = () => {
        setOpen(false);
        setReason('');
        setTtl(15);
        dispatch(clearLastStarted());
    };

    const sizeClasses = size === 'sm'
        ? 'px-2 py-1 text-xs'
        : 'px-3 py-1.5 text-sm';

    return (
        <>
            <button type="button" onClick={() => setOpen(true)}
                className={`inline-flex items-center gap-1 ${sizeClasses} border border-slate-300 hover:bg-slate-50 rounded`}>
                <UserCheck size={12} /> Sign in as
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-base font-semibold">Impersonate user</h3>
                            <button type="button" onClick={closeModal}
                                className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                        </div>

                        <div className="p-5 space-y-3">
                            {!lastStarted ? (
                                <>
                                    <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
                                        You will sign in <strong>as</strong> {user.email}. The customer app will show
                                        a red banner during the session, and every action you take will be audit-logged
                                        as performed by you on behalf of them.
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1">
                                            Reason <span className="text-red-500">*</span>
                                        </label>
                                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                                            placeholder="e.g. Investigating customer ticket #12345 — scoring discrepancy"
                                            className="w-full text-sm p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20" />
                                        <p className="text-xs text-slate-500 mt-1">Required, minimum 5 characters. Recorded permanently.</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1">
                                            Duration (minutes, max 30)
                                        </label>
                                        <input type="number" min="1" max="30" value={ttl}
                                            onChange={(e) => setTtl(Number(e.target.value))}
                                            className="w-full text-sm p-2 border border-slate-300 rounded-md" />
                                    </div>
                                    <div className="flex items-center justify-end gap-2 pt-1">
                                        <button type="button" onClick={closeModal}
                                            className="px-3 py-1.5 text-sm text-slate-700 hover:text-slate-900">Cancel</button>
                                        <button type="button" onClick={submit}
                                            disabled={busy || reason.trim().length < 5}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-md">
                                            {busy && <Loader2 size={14} className="animate-spin" />}
                                            Start session
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-900">
                                        Session started. Token expires in 15 min.
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1">
                                            Customer app URL (one-tap to log in as {lastStarted.target_user?.email})
                                        </label>
                                        <div className="flex gap-1">
                                            <input type="text" readOnly value={lastStarted.customer_app_url ?? ''}
                                                className="flex-1 font-mono text-xs p-2 border border-slate-300 rounded-md bg-slate-50" />
                                            <button type="button" onClick={() => navigator.clipboard.writeText(lastStarted.customer_app_url ?? '')}
                                                className="px-2 py-1 border border-slate-300 rounded hover:bg-slate-50" title="Copy URL">
                                                <Copy size={14} />
                                            </button>
                                            {lastStarted.customer_app_url && (
                                                <a href={lastStarted.customer_app_url} target="_blank" rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-guardian-navy hover:bg-guardian-navy-800 text-white rounded text-sm">
                                                    <ExternalLink size={14} /> Open
                                                </a>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Session ID: <code>{lastStarted.session_id}</code>
                                        </p>
                                    </div>
                                    <div className="flex justify-end pt-1">
                                        <button type="button" onClick={closeModal}
                                            className="px-3 py-1.5 text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-md">
                                            Done
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
