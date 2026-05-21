import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, Link } from 'react-router-dom';
import {
    Activity, Search, AlertTriangle, Shield, Sword, FileText,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import {
    fetchPlatformActivity, fetchCompanyActivity,
    selectPlatformActivity, selectPlatformBuckets, selectPlatformActivityLoading,
    selectCompanyActivity, selectCompanyActivityLoading,
} from '../features/admin/adminActivitySlice';

/**
 * Activity stream — platform-wide by default, or filtered to one
 * company when ?company=cmp_xxx is in the URL (deep-linked from
 * AdminCompanies detail view and from AdminOverview).
 *
 * Combines scans, alerts, takedowns, and audit events into one feed
 * served by AdminActivityController.
 */

const TYPE_FILTERS = [
    { value: '',          label: 'All types' },
    { value: 'scan',      label: 'Scans' },
    { value: 'alert',     label: 'Alerts' },
    { value: 'takedown',  label: 'Takedowns' },
    { value: 'audit',     label: 'Admin actions' },
];

const TYPE_META = {
    scan:     { icon: Search,         classes: 'text-sky-700 bg-sky-50' },
    alert:    { icon: AlertTriangle,  classes: 'text-amber-800 bg-amber-50' },
    takedown: { icon: Sword,          classes: 'text-red-700 bg-red-50' },
    audit:    { icon: Shield,         classes: 'text-slate-700 bg-slate-100' },
};

export default function AdminActivity() {
    const dispatch = useDispatch();
    const [params, setParams] = useSearchParams();
    const companyId = params.get('company');

    const platformFeed     = useSelector(selectPlatformActivity);
    const platformBuckets  = useSelector(selectPlatformBuckets);
    const platformLoading  = useSelector(selectPlatformActivityLoading);
    const companyFeed      = useSelector((s) => selectCompanyActivity(s, companyId));
    const companyLoading   = useSelector((s) => selectCompanyActivityLoading(s, companyId));

    const [typeFilter, setTypeFilter] = useState('');

    useEffect(() => {
        if (companyId) {
            dispatch(fetchCompanyActivity({ companyId, limit: 200 }));
        } else {
            dispatch(fetchPlatformActivity({ limit: 200 }));
        }
    }, [dispatch, companyId]);

    const feed    = companyId ? companyFeed : platformFeed;
    const loading = companyId ? companyLoading : platformLoading;

    const filtered = useMemo(() => {
        if (!typeFilter) return feed ?? [];
        return (feed ?? []).filter((e) => e.type === typeFilter);
    }, [feed, typeFilter]);

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy">
                    Activity {companyId && <span className="text-base font-normal text-slate-500 font-mono">/ {companyId}</span>}
                </h1>
                <p className="text-sm text-slate-600">
                    {companyId
                        ? 'What this customer has been doing on the platform.'
                        : 'Platform-wide activity feed across scans, alerts, takedowns, and admin actions.'}
                </p>
                {companyId && (
                    <button
                        type="button"
                        onClick={() => setParams({})}
                        className="mt-2 text-xs text-guardian-navy hover:underline"
                    >
                        ← Show platform-wide activity
                    </button>
                )}
            </header>

            {!companyId && platformBuckets?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
                        <Activity size={14} className="text-guardian-navy" /> Last 7 days
                    </h2>
                    <div className="h-44">
                        <ResponsiveContainer>
                            <BarChart data={platformBuckets.slice().reverse()}>
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="scan"     stackId="a" fill="#0284c7" />
                                <Bar dataKey="alert"    stackId="a" fill="#d97706" />
                                <Bar dataKey="takedown" stackId="a" fill="#dc2626" />
                                <Bar dataKey="audit"    stackId="a" fill="#64748b" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                {TYPE_FILTERS.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTypeFilter(opt.value)}
                        className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                            typeFilter === opt.value
                                ? 'bg-guardian-navy text-white'
                                : 'bg-white border border-slate-300 text-slate-600 hover:border-slate-400'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-lg">
                {loading && !filtered.length ? (
                    <div className="p-8 text-center text-slate-500">Loading activity...</div>
                ) : !filtered.length ? (
                    <div className="p-8 text-center text-slate-500">No activity matches this filter.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filtered.map((e, i) => (
                            <ActivityRow key={`${e.type}-${e.target_id}-${i}`} event={e} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function ActivityRow({ event: e }) {
    const meta = TYPE_META[e.type] ?? TYPE_META.audit;
    const Icon = meta.icon;
    return (
        <div className="flex items-start gap-3 p-3 hover:bg-slate-50/50">
            <div className={`p-2 rounded-md ${meta.classes} flex-shrink-0`}>
                <Icon size={14} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-900">{e.summary}</div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                    <span>{e.at ? formatDistanceToNow(parseISO(e.at), { addSuffix: true }) : ''}</span>
                    {e.company_id && (
                        <Link to={`/companies/${e.company_id}`} className="font-mono text-guardian-navy hover:underline">
                            {e.company_id}
                        </Link>
                    )}
                    {e.actor  && <span className="font-mono">by {e.actor}</span>}
                    {e.action && <code className="px-1 py-0.5 bg-slate-100 rounded">{e.action}</code>}
                </div>
            </div>
        </div>
    );
}
