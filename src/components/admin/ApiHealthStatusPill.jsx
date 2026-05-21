import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';

const STATUS_CONFIG = {
    healthy:  { label: 'Healthy',  icon: CheckCircle2,  classes: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
    degraded: { label: 'Degraded', icon: AlertTriangle, classes: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' },
    down:     { label: 'Down',     icon: XCircle,       classes: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
    unknown:  { label: 'Unknown',  icon: HelpCircle,    classes: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' },
};

export default function ApiHealthStatusPill({ status, className = '', showIcon = true, size = 'sm' }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
    const Icon = cfg.icon;
    const sizeClasses = size === 'lg'
        ? 'px-3 py-1 text-sm'
        : 'px-2 py-0.5 text-xs';

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${cfg.classes} ${sizeClasses} ${className}`}>
            {showIcon && <Icon size={size === 'lg' ? 14 : 12} strokeWidth={2.5} />}
            {cfg.label}
        </span>
    );
}
