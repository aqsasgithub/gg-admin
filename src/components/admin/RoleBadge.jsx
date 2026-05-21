import { Crown, Shield, LifeBuoy, Terminal, Eye } from 'lucide-react';

/**
 * Compact pill for an admin role. Color tokens follow the
 * project-wide severity scheme:
 *   owner    → guardian-navy (highest)
 *   security → critical (decision authority)
 *   support  → medium     (customer-facing)
 *   dev      → info       (technical)
 *   viewer   → muted      (read-only)
 */

const ROLE_CONFIG = {
    owner:    { label: 'Owner',    icon: Crown,    classes: 'bg-guardian-navy text-white' },
    security: { label: 'Security', icon: Shield,   classes: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
    support:  { label: 'Support',  icon: LifeBuoy, classes: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' },
    dev:      { label: 'Dev',      icon: Terminal, classes: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200' },
    viewer:   { label: 'Viewer',   icon: Eye,      classes: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200' },
};

export default function RoleBadge({ role, className = '' }) {
    const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.viewer;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.classes} ${className}`}>
            <Icon size={12} strokeWidth={2.5} />
            {cfg.label}
        </span>
    );
}
