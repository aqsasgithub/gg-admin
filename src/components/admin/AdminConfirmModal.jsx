import { useEffect, useState } from 'react';
import { AlertOctagon, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Reusable confirmation modal used everywhere in the god-mode portal.
 *
 *   <AdminConfirmModal
 *     open={...}
 *     title="..."
 *     description="..."
 *     confirmLabel="..."
 *     variant="destructive" | "warning" | "default"
 *     requireReason
 *     onCancel={...}
 *     onConfirm={(reason?) => Promise<void>}
 *   />
 *
 * Variants change the icon and button colour. `requireReason` adds a
 * textarea and the reason is passed to onConfirm.
 */
export default function AdminConfirmModal({
    open,
    title,
    description,
    confirmLabel = 'Confirm',
    variant = 'default',
    requireReason = false,
    onCancel,
    onConfirm,
}) {
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => { if (open) { setReason(''); setBusy(false); } }, [open]);
    if (!open) return null;

    const ok = !requireReason || reason.trim().length > 0;

    const Icon = variant === 'destructive' ? AlertOctagon
              : variant === 'warning'     ? AlertTriangle
              : null;
    const iconColor = variant === 'destructive' ? 'text-red-600'
                    : variant === 'warning'     ? 'text-amber-600'
                    : 'text-guardian-navy';
    const btnColor  = variant === 'destructive' ? 'bg-red-600 hover:bg-red-700'
                    : variant === 'warning'     ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-guardian-navy hover:bg-guardian-navy-800';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
                <div className="p-5 border-b border-slate-100 flex items-start gap-3">
                    {Icon && <Icon size={20} className={`${iconColor} flex-shrink-0 mt-0.5`} />}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
                    </div>
                    <button type="button" onClick={onCancel}
                        className="text-slate-400 hover:text-slate-700 text-xl leading-none flex-shrink-0">×</button>
                </div>

                {requireReason && (
                    <div className="p-5 pt-0 pb-3">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                            Reason {requireReason && <span className="text-red-500">*</span>}
                        </label>
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                            placeholder="Recorded permanently in the audit log."
                            className="w-full text-sm p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20" />
                    </div>
                )}

                <div className="px-5 pb-5 flex justify-end gap-2">
                    <button type="button" onClick={onCancel}
                        className="px-3 py-1.5 text-sm text-slate-700 hover:text-slate-900">
                        Cancel
                    </button>
                    <button type="button" disabled={!ok || busy}
                        onClick={async () => {
                            setBusy(true);
                            try { await onConfirm(requireReason ? reason.trim() : undefined); }
                            finally { setBusy(false); }
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-md disabled:opacity-50 ${btnColor}`}>
                        {busy && <Loader2 size={14} className="animate-spin" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
