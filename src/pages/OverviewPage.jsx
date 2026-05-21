import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
    Users, Building2, ShieldAlert, Activity, Server,
    TrendingUp, ArrowRight, Clock, AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchAdminCompanies, selectAdminCompanies, selectAdminCompaniesMeta,
} from '../features/admin/adminCompaniesSlice';
import {
    fetchAdminUsers, selectAdminUsersMeta,
} from '../features/admin/adminUsersSlice';
import {
    fetchApiHealth, selectApiHealthSummary, selectApiHealthProbes,
} from '../features/admin/adminApiHealthSlice';
import {
    fetchPlatformActivity, selectPlatformActivity,
} from '../features/admin/adminActivitySlice';
import {
    fetchAuditLog, selectAuditLog,
} from '../features/admin/adminAuditSlice';
import ApiHealthStatusPill from '../components/admin/ApiHealthStatusPill';
import LicensePlanBadge from '../components/admin/LicensePlanBadge';

/**
 * The replacement for the broken AdminOverview.jsx.
 *
 * Every endpoint this page calls actually exists on the backend, so
 * unlike the previous implementation the metrics aren't permanently
 * stuck at zero.
 */

export default function AdminOverview() {
    const dispatch = useDispatch();

    const companies     = useSelector(selectAdminCompanies);
    const companiesMeta = useSelector(selectAdminCompaniesMeta);
    const usersMeta     = useSelector(selectAdminUsersMeta);
    const apiSummary    = useSelector(selectApiHealthSummary);
    const apiProbes     = useSelector(selectApiHealthProbes);
    const activity      = useSelector(selectPlatformActivity);
    const auditTail     = useSelector(selectAuditLog);

    useEffect(() => {
        dispatch(fetchAdminCompanies({ per_page: 5 }));
        dispatch(fetchAdminUsers({ per_page: 1 }));        // just want meta.total
        dispatch(fetchApiHealth());
        dispatch(fetchPlatformActivity({ limit: 10 }));
        dispatch(fetchAuditLog({ per_page: 8 }));
    }, [dispatch]);

    const downProbes = useMemo(
        () => (apiProbes ?? []).filter((p) => p.status === 'down').slice(0, 5),
        [apiProbes]
    );
    const expiringSoon = useMemo(
        () => (companies ?? []).filter((c) => {
            if (!c.license?.expires_at) return false;
            const diff = new Date(c.license.expires_at).getTime() - Date.now();
            return diff > 0 && diff < 1000 * 60 * 60 * 24 * 14;        // 14 days
        }).slice(0, 5),
        [companies]
    );

    return (
        <div className="p-6 space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy">Admin Overview</h1>
                <p className="text-sm text-slate-600">Platform-wide status and recent activity.</p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={Building2} label="Companies" value={companiesMeta?.total ?? '—'} to="/companies" />
                <StatCard icon={Users}     label="Users"     value={usersMeta?.total     ?? '—'} to="/users" />
                <StatCard
                    icon={Server}
                    label="APIs Healthy"
                    value={apiSummary ? `${apiSummary.healthy}/${apiSummary.total}` : '—'}
                    sub={apiSummary?.down ? `${apiSummary.down} down` : null}
                    subTone={apiSummary?.down ? 'critical' : 'success'}
                    to="/api-health"
                />
                <StatCard icon={Activity}  label="Events (7d)" value={activity?.length ?? '—'} to="/activity" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                <SectionCard
                    title="API health — alerts"
                    icon={ShieldAlert}
                    linkTo="/api-health"
                    empty={downProbes.length === 0}
                    emptyMessage="All probes healthy or degraded — no outages."
                >
                    {downProbes.map((p) => (
                        <Link
                            key={p.service_key}
                            to={`/api-health/${p.service_key}`}
                            className="flex items-center justify-between p-2 rounded hover:bg-slate-50"
                        >
                            <div>
                                <div className="text-sm font-medium text-slate-900">{p.service_label}</div>
                                <div className="text-xs text-slate-500">{p.last_error ?? 'No error'}</div>
                            </div>
                            <ApiHealthStatusPill status={p.status} />
                        </Link>
                    ))}
                </SectionCard>

                <SectionCard
                    title="Licenses expiring soon"
                    icon={Clock}
                    linkTo="/licensing"
                    empty={expiringSoon.length === 0}
                    emptyMessage="Nothing expires in the next 14 days."
                >
                    {expiringSoon.map((c) => (
                        <Link
                            key={c.id}
                            to={`/companies/${c.id}`}
                            className="flex items-center justify-between p-2 rounded hover:bg-slate-50"
                        >
                            <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-900 truncate">{c.name}</div>
                                <div className="text-xs text-slate-500">
                                    {c.license?.expires_at
                                        ? `expires ${formatDistanceToNow(parseISO(c.license.expires_at), { addSuffix: true })}`
                                        : '—'}
                                </div>
                            </div>
                            <LicensePlanBadge plan={c.license?.plan} status={c.license?.status} />
                        </Link>
                    ))}
                </SectionCard>

                <SectionCard
                    title="Recent admin actions"
                    icon={TrendingUp}
                    linkTo="/audit"
                    empty={!auditTail?.length}
                    emptyMessage="No recent admin actions."
                >
                    {(auditTail ?? []).slice(0, 6).map((row) => (
                        <div key={row.id} className="p-2 rounded hover:bg-slate-50">
                            <div className="text-sm text-slate-900 truncate">{row.summary || row.action}</div>
                            <div className="text-xs text-slate-500 flex gap-2">
                                <span>{row.actor_role}</span>
                                <span>·</span>
                                <span>{row.created_at ? formatDistanceToNow(parseISO(row.created_at), { addSuffix: true }) : '—'}</span>
                            </div>
                        </div>
                    ))}
                </SectionCard>
            </div>

            <SectionCard title="Platform activity feed" icon={Activity} linkTo="/activity">
                <div className="divide-y divide-slate-100">
                    {(activity ?? []).slice(0, 8).map((e, i) => (
                        <div key={`${e.type}-${e.target_id}-${i}`} className="py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                                <TypePill type={e.type} />
                                <span className="text-sm text-slate-700 truncate">{e.summary}</span>
                            </div>
                            <div className="text-xs text-slate-400 whitespace-nowrap">
                                {e.at ? formatDistanceToNow(parseISO(e.at), { addSuffix: true }) : ''}
                            </div>
                        </div>
                    ))}
                    {!activity?.length && (
                        <div className="py-6 text-center text-sm text-slate-500">No recent activity.</div>
                    )}
                </div>
            </SectionCard>
        </div>
    );
}

// ── Internal subcomponents ────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, subTone = 'muted', to }) {
    const subClasses = subTone === 'critical'
        ? 'text-red-600'
        : subTone === 'success'
            ? 'text-emerald-600'
            : 'text-slate-500';

    const content = (
        <div className="p-4 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium uppercase tracking-wide">
                <Icon size={14} /> {label}
            </div>
            <div className="mt-1.5 text-2xl font-semibold text-guardian-navy">{value}</div>
            {sub && <div className={`mt-0.5 text-xs ${subClasses}`}>{sub}</div>}
        </div>
    );
    return to ? <Link to={to}>{content}</Link> : content;
}

function SectionCard({ title, icon: Icon, linkTo, children, empty, emptyMessage }) {
    return (
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    {Icon && <Icon size={16} className="text-guardian-navy" />} {title}
                </h2>
                {linkTo && (
                    <Link to={linkTo} className="text-xs text-guardian-navy hover:underline inline-flex items-center gap-0.5">
                        View all <ArrowRight size={12} />
                    </Link>
                )}
            </div>
            {empty ? (
                <div className="py-6 text-center text-sm text-slate-500">{emptyMessage ?? 'Nothing to show.'}</div>
            ) : (
                <div className="space-y-1">{children}</div>
            )}
        </div>
    );
}

function TypePill({ type }) {
    const map = {
        scan:     'bg-sky-50 text-sky-700',
        alert:    'bg-amber-50 text-amber-800',
        takedown: 'bg-red-50 text-red-700',
        audit:    'bg-slate-100 text-slate-700',
    };
    return (
        <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${map[type] ?? 'bg-slate-100 text-slate-600'}`}>
            {type}
        </span>
    );
}
