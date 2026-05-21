import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    Server, RefreshCw, ArrowLeft, Bell, BellOff, Activity, Loader2,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchApiHealth, fetchApiHealthDetail, forceProbe, setAlertingEnabled,
    selectApiHealthSummary, selectApiHealthProbes, selectApiHealthLoading,
    selectApiHealthDetail, selectIsProbing, selectLastFetchedAt,
} from '../features/admin/adminApiHealthSlice';
import ApiHealthStatusPill from '../components/admin/ApiHealthStatusPill';
import LatencySparkline from '../components/admin/LatencySparkline';

/**
 * API health monitor for the 40+ external scanners.
 *
 * Routes:
 *   /api-health        → grid view (this)
 *   /api-health/:key   → per-probe drilldown (also this — drilldown branch)
 */

export default function AdminApiHealth() {
    const { key } = useParams();
    return key ? <ProbeDetail serviceKey={key} /> : <ProbeGrid />;
}

// ── Grid ─────────────────────────────────────────────────────────────────

function ProbeGrid() {
    const dispatch = useDispatch();
    const summary  = useSelector(selectApiHealthSummary);
    const probes   = useSelector(selectApiHealthProbes);
    const loading  = useSelector(selectApiHealthLoading);
    const lastFetched = useSelector(selectLastFetchedAt);

    const [statusFilter,   setStatusFilter]   = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    useEffect(() => {
        dispatch(fetchApiHealth());
        // Auto-refresh every 30s. Probes happen every minute on the
        // backend, so polling at half that gives near-realtime visibility.
        const t = setInterval(() => dispatch(fetchApiHealth()), 30_000);
        return () => clearInterval(t);
    }, [dispatch]);

    const grouped = useMemo(() => {
        const filtered = (probes ?? []).filter((p) => {
            if (statusFilter   && p.status   !== statusFilter)   return false;
            if (categoryFilter && p.category !== categoryFilter) return false;
            return true;
        });
        const byCat = {};
        for (const p of filtered) {
            (byCat[p.category] ??= []).push(p);
        }
        return byCat;
    }, [probes, statusFilter, categoryFilter]);

    return (
        <div className="p-6 space-y-4">
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy">API Health</h1>
                    <p className="text-sm text-slate-600">
                        Status of every external scanner, calculator, and integration.
                        {lastFetched && <span> · Refreshed {formatDistanceToNow(parseISO(lastFetched), { addSuffix: true })}.</span>}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => dispatch(fetchApiHealth())}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Refresh
                </button>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Healthy"  value={summary?.healthy  ?? 0} tone="success"  onClick={() => setStatusFilter('healthy')} />
                <Stat label="Degraded" value={summary?.degraded ?? 0} tone="warning"  onClick={() => setStatusFilter('degraded')} />
                <Stat label="Down"     value={summary?.down     ?? 0} tone="critical" onClick={() => setStatusFilter('down')} />
                <Stat label="Unknown"  value={summary?.unknown  ?? 0} tone="muted"    onClick={() => setStatusFilter('unknown')} />
            </div>

            <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Filters:</span>
                <FilterChip label="All categories" active={!categoryFilter} onClick={() => setCategoryFilter('')} />
                {['scanner', 'calculator', 'integration', 'internal'].map((c) => (
                    <FilterChip key={c} label={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)} />
                ))}
                {statusFilter && (
                    <button
                        type="button"
                        onClick={() => setStatusFilter('')}
                        className="ml-auto text-xs text-slate-600 hover:text-slate-900"
                    >
                        Clear status filter ({statusFilter}) ✕
                    </button>
                )}
            </div>

            {Object.keys(grouped).length === 0 ? (
                <div className="p-12 bg-white border border-slate-200 rounded-lg text-center text-sm text-slate-500">
                    No probes match this filter. Did you run <code>php artisan apihealth:seed</code>?
                </div>
            ) : (
                Object.entries(grouped).map(([category, list]) => (
                    <section key={category} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                            <h2 className="text-sm font-semibold text-slate-900 capitalize">
                                {category}s <span className="text-xs font-normal text-slate-500">({list.length})</span>
                            </h2>
                        </div>
                        <table className="min-w-full text-sm">
                            <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-3 py-2 text-left">Service</th>
                                    <th className="px-3 py-2 text-left">Status</th>
                                    <th className="px-3 py-2 text-right">Latency</th>
                                    <th className="px-3 py-2 text-right">Uptime 24h</th>
                                    <th className="px-3 py-2 text-left">Last checked</th>
                                    <th className="px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {list.map((p) => <ProbeRow key={p.service_key} probe={p} />)}
                            </tbody>
                        </table>
                    </section>
                ))
            )}
        </div>
    );
}

function ProbeRow({ probe: p }) {
    const dispatch = useDispatch();
    const probing  = useSelector((s) => selectIsProbing(s, p.service_key));

    return (
        <tr>
            <td className="px-3 py-2.5">
                <Link to={`/api-health/${p.service_key}`} className="block group">
                    <div className="font-medium text-slate-900 group-hover:text-guardian-navy">{p.service_label}</div>
                    <div className="text-xs text-slate-500 font-mono">{p.service_key}</div>
                </Link>
            </td>
            <td className="px-3 py-2.5">
                <ApiHealthStatusPill status={p.status} />
                {p.last_error && (
                    <div className="text-xs text-slate-500 mt-1 truncate max-w-xs" title={p.last_error}>
                        {p.last_error}
                    </div>
                )}
            </td>
            <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums">
                {p.last_latency_ms != null ? `${p.last_latency_ms}ms` : '—'}
            </td>
            <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums">
                {p.uptime_pct_24h != null ? `${p.uptime_pct_24h}%` : '—'}
            </td>
            <td className="px-3 py-2.5 text-xs text-slate-500">
                {p.last_checked_at
                    ? formatDistanceToNow(parseISO(p.last_checked_at), { addSuffix: true })
                    : 'never'}
            </td>
            <td className="px-3 py-2.5 text-right">
                <button
                    type="button"
                    disabled={probing}
                    onClick={() => dispatch(forceProbe(p.service_key))}
                    title="Force a synchronous re-probe"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-guardian-navy hover:bg-guardian-navy/5 rounded disabled:opacity-50"
                >
                    {probing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Probe
                </button>
            </td>
        </tr>
    );
}

function Stat({ label, value, tone, onClick }) {
    const tones = {
        success:  'text-emerald-700 bg-emerald-50',
        warning:  'text-amber-800 bg-amber-50',
        critical: 'text-red-700 bg-red-50',
        muted:    'text-slate-700 bg-slate-100',
    };
    return (
        <button
            type="button"
            onClick={onClick}
            className={`text-left p-4 rounded-lg border border-slate-200 hover:shadow-sm transition-shadow ${tones[tone] ?? 'bg-white'}`}
        >
            <div className="text-xs font-medium uppercase tracking-wide">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
        </button>
    );
}

function FilterChip({ label, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-2 py-1 text-xs rounded-full transition-colors ${
                active
                    ? 'bg-guardian-navy text-white'
                    : 'bg-white border border-slate-300 text-slate-600 hover:border-slate-400'
            }`}
        >
            {label}
        </button>
    );
}

// ── Detail / drill-down ──────────────────────────────────────────────────

function ProbeDetail({ serviceKey }) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const detail   = useSelector((s) => selectApiHealthDetail(s, serviceKey));
    const probing  = useSelector((s) => selectIsProbing(s, serviceKey));

    useEffect(() => {
        dispatch(fetchApiHealthDetail(serviceKey));
    }, [dispatch, serviceKey]);

    if (!detail) {
        return (
            <div className="p-6 flex items-center gap-2 text-slate-500">
                <Loader2 size={16} className="animate-spin" /> Loading probe...
            </div>
        );
    }

    const { probe, events } = detail;

    const reprobe = async () => {
        await dispatch(forceProbe(serviceKey));
        dispatch(fetchApiHealthDetail(serviceKey));
    };

    return (
        <div className="p-6 space-y-4">
            <button
                type="button"
                onClick={() => navigate('/api-health')}
                className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
            >
                <ArrowLeft size={14} /> Back to API health
            </button>

            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy">{probe.service_label}</h1>
                    <div className="text-sm text-slate-500 font-mono">{probe.service_key}</div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => dispatch(setAlertingEnabled({ serviceKey, enabled: !probe.alerting_enabled }))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
                    >
                        {probe.alerting_enabled ? <Bell size={14} /> : <BellOff size={14} className="text-slate-400" />}
                        {probe.alerting_enabled ? 'Alerting on' : 'Silenced'}
                    </button>
                    <button
                        type="button"
                        disabled={probing}
                        onClick={reprobe}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-guardian-navy hover:bg-guardian-navy-800 text-white text-sm font-medium rounded-md disabled:opacity-50"
                    >
                        {probing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Force probe
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-white border border-slate-200 rounded-lg">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
                    <div className="mt-1.5">
                        <ApiHealthStatusPill status={probe.status} size="lg" />
                    </div>
                </div>
                <Box label="Latency"   value={probe.last_latency_ms     != null ? `${probe.last_latency_ms}ms`    : '—'} />
                <Box label="Uptime 24h" value={probe.uptime_pct_24h      != null ? `${probe.uptime_pct_24h}%`      : '—'} />
                <Box label="Avg latency 24h" value={probe.avg_latency_ms_24h != null ? `${Math.round(probe.avg_latency_ms_24h)}ms` : '—'} />
            </div>

            <section className="bg-white border border-slate-200 rounded-lg p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
                    <Activity size={14} className="text-guardian-navy" /> Latency over the last 24h
                </h2>
                <div className="h-32">
                    <LatencySparkline events={events ?? []} height={120} />
                </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <h2 className="text-sm font-semibold">Recent events (last 24h)</h2>
                </div>
                <div className="max-h-96 overflow-y-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-white text-xs uppercase tracking-wide text-slate-500 sticky top-0">
                            <tr>
                                <th className="px-3 py-2 text-left">When</th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th className="px-3 py-2 text-right">Latency</th>
                                <th className="px-3 py-2 text-right">HTTP</th>
                                <th className="px-3 py-2 text-left">Error</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(events ?? []).slice().reverse().map((e, i) => (
                                <tr key={`${e.checked_at}-${i}`}>
                                    <td className="px-3 py-1.5 text-xs text-slate-600 whitespace-nowrap">
                                        {formatDistanceToNow(parseISO(e.checked_at), { addSuffix: true })}
                                    </td>
                                    <td className="px-3 py-1.5">
                                        <ApiHealthStatusPill status={e.status} />
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-slate-700 tabular-nums">
                                        {e.latency_ms != null ? `${e.latency_ms}ms` : '—'}
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-slate-700 tabular-nums">
                                        {e.http_code ?? '—'}
                                    </td>
                                    <td className="px-3 py-1.5 text-xs text-slate-500 truncate max-w-md">
                                        {e.error ?? ''}
                                    </td>
                                </tr>
                            ))}
                            {!events?.length && (
                                <tr><td colSpan="5" className="px-3 py-6 text-center text-slate-500">No events in the last 24h.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

function Box({ label, value }) {
    return (
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-1.5 text-2xl font-semibold text-guardian-navy tabular-nums">{value}</div>
        </div>
    );
}
