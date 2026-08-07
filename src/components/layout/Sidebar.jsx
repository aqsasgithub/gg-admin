import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    LayoutDashboard, Users, Building2, Globe, Wifi, Sword, Shield,
    CreditCard, Server, ScrollText, Activity, AlertTriangle, ScanLine,
    Mail, Trash2, Plug, BugPlay, ToggleRight, Megaphone, Heart, ListTree,
    UserCog, DollarSign, Tag, Power, Ticket, Clock, ShieldCheck, Layers,
    ShieldHalf, Radio, Gauge, ClipboardCheck, Radar,
} from 'lucide-react';
import { selectAdminCapabilities, selectAdminRoles } from '../../features/auth/authSlice';

/**
 * Left-rail navigation. Groups, in order:
 *   1. Overview                — quick orient
 *   2. Tenants & people        — who, what they have
 *   3. Operations              — running the platform day-to-day
 *   4. Platform & ops          — health, infra, comms
 *   5. Finance                 — costs and pricing (bundle 5)
 *   6. Compliance & governance — audit, privacy
 *   7. Incident                — break-glass (owner-only)
 *
 * Items declare their required capability. Non-applicable sections
 * simply don't render. The backend is the real gate.
 */

const GROUPS = [
    {
        label: null,
        items: [
            { to: '/',          label: 'Overview',  icon: LayoutDashboard, cap: null },
        ],
    },
    {
        label: 'Tenants & people',
        items: [
            { to: '/users',          label: 'Users',           icon: Users,         cap: 'users.read' },
            { to: '/companies',      label: 'Companies',       icon: Building2,     cap: 'companies.read' },
            { to: '/domains',        label: 'Domains',         icon: Globe,         cap: 'companies.read' },
            { to: '/assets',         label: 'Assets / IPs',    icon: Wifi,          cap: 'companies.read' },
            { to: '/impersonations', label: 'Impersonations',  icon: UserCog,       cap: 'impersonation.read' },
            { to: '/login-history',  label: 'Login history',   icon: Clock,         cap: 'users.read' },
        ],
    },
    {
        label: 'Operations',
        items: [
            { to: '/alerts',       label: 'Alerts',         icon: AlertTriangle, cap: 'alerts.read' },
            { to: '/issues',       label: 'Issues',         icon: BugPlay,       cap: 'issues.read' },
            { to: '/tickets',      label: 'Tickets',        icon: Ticket,        cap: 'tickets.read' },
            { to: '/takedowns',    label: 'Takedowns',      icon: Sword,         cap: 'takedowns.read' },
            { to: '/scans',        label: 'Scans',          icon: ScanLine,      cap: 'scans.read' },
            { to: '/scan-control', label: 'Scan control',   icon: Power,         cap: 'scans.control' },
            { to: '/threat-intelligence', label: 'Threat Intel', icon: Radar,   cap: 'threat_intel.read' },
            { to: '/email-logs', label: 'Email logs', icon: Mail, cap: 'email_logs.read' },
        ],
    },
    {
        label: 'Module data',
        items: [
            { to: '/modules/brand-protection',     label: 'Brand Protection',     icon: ShieldCheck, cap: 'module.brand_protection.read' },
            { to: '/modules/domain-security',      label: 'Domain Security',      icon: Globe,       cap: 'module.domain_security.read' },
            { to: '/modules/application-security', label: 'Application Security', icon: Layers,      cap: 'module.application_security.read' },
            { to: '/modules/network-security',     label: 'Network Security',     icon: Wifi,        cap: 'module.network_security.read' },
            { to: '/modules/cloud-security',       label: 'Cloud Security',       icon: Server,      cap: 'module.cloud_security.read' },
            { to: '/modules/compliance',           label: 'Compliance',           icon: Shield,      cap: 'module.compliance.read' },
        ],
    },
    {
        label: 'Platform & ops',
        items: [
            { to: '/api-health',    label: 'API Health',     icon: Server,    cap: 'apihealth.read' },
            { to: '/system-health', label: 'System Health',  icon: Heart,     cap: 'system.read' },
            { to: '/jobs',          label: 'Background jobs', icon: ListTree, cap: 'system.read' },
            { to: '/notifications', label: 'Notifications',  icon: Mail,      cap: 'notifications.read' },
            { to: '/integrations',  label: 'Integrations',   icon: Plug,      cap: 'integrations.read' },
            { to: '/feature-flags', label: 'Feature flags',  icon: ToggleRight, cap: 'flags.read' },
            { to: '/announcements', label: 'Announcements',  icon: Megaphone, cap: 'announcements.read' },
        ],
    },
    {
        label: 'Finance',
        items: [
            { to: '/costs',      label: 'Cost analytics', icon: DollarSign, cap: 'costs.read' },
            { to: '/pricing',    label: 'Pricing plans',  icon: Tag,        cap: 'pricing.read' },
            { to: '/licensing',           label: 'Licensing',           icon: CreditCard, cap: 'licenses.read' },
            { to: '/license-applications', label: 'License applications', icon: CreditCard, cap: 'licenses.read' },
        ],
    },
    {
        label: 'Compliance & governance',
        items: [
            { to: '/audit',     label: 'Audit Log', icon: ScrollText, cap: 'audit.read' },
            { to: '/activity',  label: 'Activity',  icon: Activity,   cap: 'activity.read' },
            { to: '/privacy',   label: 'Privacy ops', icon: Trash2,   cap: 'privacy.read' },
        ],
    },
    {
        label: 'Control plane',
        items: [
            { to: '/findings',    label: 'Findings Control', icon: ShieldHalf,     cap: 'findings.read' },
            { to: '/api-control', label: 'API Control',      icon: Radio,          cap: 'apicontrol.read' },
            { to: '/scoring',     label: 'Scoring Control',  icon: Gauge,          cap: 'scoring.read' },
            { to: '/approvals',   label: 'Approvals',        icon: ClipboardCheck, cap: 'approvals.read' },
        ],
    },
    {
        label: 'Incident',
        items: [
            { to: '/incident',  label: 'Incident response', icon: Shield, cap: 'incident.act' },
        ],
    },
];

export default function Sidebar() {
    const caps  = useSelector(selectAdminCapabilities);
    const roles = useSelector(selectAdminRoles);
    const has = (cap) => !cap || caps.includes('*') || caps.includes(cap);

    return (
        <aside className="w-60 bg-guardian-navy text-slate-100 flex flex-col">
            <div className="px-4 py-4 border-b border-white/10 flex items-center gap-2">
                <Shield size={18} className="text-white/90" />
                <div>
                    <div className="text-sm font-semibold">GuardianGaze</div>
                    <div className="text-[10px] uppercase tracking-widest text-white/50">Admin Portal</div>
                </div>
            </div>

            <nav className="flex-1 px-2 py-3 overflow-y-auto">
                {GROUPS.map((group, gi) => {
                    const visible = group.items.filter((i) => has(i.cap));
                    if (!visible.length) return null;
                    return (
                        <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
                            {group.label && (
                                <div className="px-3 mb-1 text-[10px] uppercase tracking-widest text-white/40">
                                    {group.label}
                                </div>
                            )}
                            <div className="space-y-0.5">
                                {visible.map((i) => {
                                    const Icon = i.icon;
                                    return (
                                        <NavLink key={i.to} to={i.to} end={i.to === '/'}
                                            className={({ isActive }) =>
                                                `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                                                    isActive
                                                        ? 'bg-white/10 text-white'
                                                        : 'text-white/70 hover:text-white hover:bg-white/5'
                                                }`}>
                                            <Icon size={14} /> {i.label}
                                        </NavLink>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </nav>

            <div className="px-4 py-3 border-t border-white/10">
                <div className="text-[10px] uppercase tracking-widest text-white/50 mb-1">Your roles</div>
                <div className="flex flex-wrap gap-1">
                    {roles.length === 0 && <span className="text-xs text-white/40">none</span>}
                    {roles.map((r) => (
                        <span key={r} className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-white/10 text-white/90 capitalize">
                            {r}
                        </span>
                    ))}
                </div>
            </div>
        </aside>
    );
}
