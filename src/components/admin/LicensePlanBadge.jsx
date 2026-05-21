import { formatDistanceToNow, parseISO } from 'date-fns';

/**
 * Renders the company's license as: [Pro] · active · expires in 27d
 *
 * Color rules:
 *   trial     → muted gray
 *   starter   → sky
 *   pro       → indigo (the project's guardian-navy adjacent)
 *   enterprise→ emerald
 *   custom    → amber
 *
 * Status overrides the color when not 'active':
 *   past_due  → amber
 *   suspended → red
 *   cancelled / expired → muted gray
 */

const PLAN_CLASSES = {
    trial:      'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
    starter:    'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
    pro:        'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
    enterprise: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    custom:     'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
};

const STATUS_LABELS = {
    active:    null,             // hidden — default expected state
    past_due:  'past due',
    suspended: 'suspended',
    cancelled: 'cancelled',
    expired:   'expired',
};

const STATUS_DOTS = {
    active:    'bg-emerald-500',
    past_due:  'bg-amber-500',
    suspended: 'bg-red-500',
    cancelled: 'bg-slate-400',
    expired:   'bg-slate-400',
};

export default function LicensePlanBadge({ plan, status, expiresAt, className = '' }) {
    if (!plan) {
        return (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 ring-1 ring-slate-200 ${className}`}>
                No license
            </span>
        );
    }

    const planClasses = PLAN_CLASSES[plan] ?? PLAN_CLASSES.trial;
    const statusLabel = STATUS_LABELS[status];
    const statusDot   = STATUS_DOTS[status] ?? 'bg-slate-400';

    let expiryHint = null;
    if (expiresAt) {
        try {
            const d = parseISO(expiresAt);
            const inPast = d.getTime() < Date.now();
            expiryHint = inPast
                ? `expired ${formatDistanceToNow(d)} ago`
                : `expires in ${formatDistanceToNow(d)}`;
        } catch { /* unparseable */ }
    }

    return (
        <span className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${planClasses} ${className}`}>
            <span className="capitalize">{plan}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            {statusLabel && <span className="text-[10px] uppercase tracking-wide">{statusLabel}</span>}
            {expiryHint && (
                <span className="text-[10px] opacity-70 font-normal ml-0.5">· {expiryHint}</span>
            )}
        </span>
    );
}
