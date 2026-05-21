import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Database, Server, HardDrive, Activity, Loader2, RefreshCw } from 'lucide-react';
import {
    fetchSystemSnapshot, fetchSlowQueries,
    selectSystemSnapshot, selectSystemLoading, selectSlowQueries,
} from '../features/admin/adminSystemSlice';

export default function SystemHealthPage() {
    const dispatch = useDispatch();
    const snap    = useSelector(selectSystemSnapshot);
    const loading = useSelector(selectSystemLoading);
    const slow    = useSelector(selectSlowQueries);

    useEffect(() => { dispatch(fetchSystemSnapshot()); dispatch(fetchSlowQueries()); }, [dispatch]);

    return (
        <div className="p-6 space-y-4">
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy">System health</h1>
                    <p className="text-sm text-slate-600">
                        Internal infrastructure status. For external scanner API health, see the API Health page.
                    </p>
                </div>
                <button type="button" onClick={() => { dispatch(fetchSystemSnapshot()); dispatch(fetchSlowQueries()); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50">
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </header>

            {loading && !snap ? (
                <div className="p-12 text-center text-slate-500">
                    <Loader2 size={20} className="inline animate-spin mr-2" /> Probing systems…
                </div>
            ) : !snap ? (
                <div className="p-6 bg-red-50 border border-red-200 rounded text-sm text-red-900">
                    Failed to fetch system snapshot. Check backend logs.
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <ProbeCard icon={Database}  title="Database" probe={snap.database} extras={[
                            ['Latency',     snap.database?.latency_ms != null ? `${snap.database.latency_ms}ms` : '—'],
                            ['Connections', snap.database?.stats?.connections ?? '—'],
                            ['Driver',      snap.database?.driver ?? '—'],
                        ]} />
                        <ProbeCard icon={Server}    title="Redis"    probe={snap.redis} extras={[
                            ['Latency',  snap.redis?.latency_ms != null ? `${snap.redis.latency_ms}ms` : '—'],
                            ['Memory',   snap.redis?.memory_mb ? `${snap.redis.memory_mb} MB` : '—'],
                            ['Peak',     snap.redis?.peak_mb ? `${snap.redis.peak_mb} MB` : '—'],
                        ]} />
                        <ProbeCard icon={Activity}  title="Queue"    probe={snap.queue} extras={[
                            ['Pending',  snap.queue?.pending_jobs ?? '—'],
                            ['Failed',   snap.queue?.failed_jobs ?? '—'],
                            ['Driver',   snap.queue?.driver ?? '—'],
                        ]} />
                        <ProbeCard icon={HardDrive} title="Disk"     probe={snap.disk} extras={[
                            ['Used',     snap.disk?.used_pct != null ? `${snap.disk.used_pct}%` : '—'],
                            ['Free',     snap.disk?.free_gb ? `${snap.disk.free_gb} GB` : '—'],
                            ['Total',    snap.disk?.total_gb ? `${snap.disk.total_gb} GB` : '—'],
                        ]} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="p-4 bg-white border border-slate-200 rounded-lg">
                            <h2 className="text-sm font-semibold text-slate-900 mb-3">Runtime</h2>
                            <dl className="space-y-1.5 text-sm">
                                <Row k="PHP version"    v={snap.php?.version ?? '—'} />
                                <Row k="Memory limit"   v={snap.php?.memory_limit ?? '—'} />
                                <Row k="Memory used"    v={`${snap.php?.memory_used_mb ?? '—'} MB`} />
                                <Row k="OPCache"        v={snap.php?.opcache_enabled ? 'enabled' : 'disabled'} />
                                <Row k="Environment"    v={snap.app?.env ?? '—'} />
                                <Row k="Debug mode"     v={
                                    <span className={snap.app?.debug ? 'text-red-600 font-medium' : 'text-slate-700'}>
                                        {snap.app?.debug ? 'ON (security risk in production)' : 'off'}
                                    </span>
                                } />
                            </dl>
                        </div>

                        <div className="p-4 bg-white border border-slate-200 rounded-lg">
                            <h2 className="text-sm font-semibold text-slate-900 mb-3">Cache</h2>
                            <dl className="space-y-1.5 text-sm">
                                <Row k="Status" v={
                                    <span className={snap.cache?.status === 'healthy' ? 'text-emerald-700' : 'text-amber-700'}>
                                        {snap.cache?.status}
                                    </span>
                                } />
                                <Row k="Driver" v={snap.cache?.driver ?? '—'} />
                            </dl>
                        </div>
                    </div>

                    {slow.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100">
                                <h2 className="text-sm font-semibold text-slate-900">Top slow queries</h2>
                                <p className="text-xs text-slate-500">From MySQL performance_schema (cumulative).</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Query</th>
                                            <th className="px-3 py-2 text-right">Count</th>
                                            <th className="px-3 py-2 text-right">Avg (ms)</th>
                                            <th className="px-3 py-2 text-right">Max (ms)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {slow.map((q, idx) => (
                                            <tr key={idx}>
                                                <td className="px-3 py-2 font-mono text-xs text-slate-700 max-w-xl truncate" title={q.query}>{q.query}</td>
                                                <td className="px-3 py-2 text-xs text-right">{q.count}</td>
                                                <td className="px-3 py-2 text-xs text-right">{q.avg_wait_ps ? Math.round(q.avg_wait_ps / 1e9) : '—'}</td>
                                                <td className="px-3 py-2 text-xs text-right">{q.max_wait_ps ? Math.round(q.max_wait_ps / 1e9) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function ProbeCard({ icon: Icon, title, probe, extras = [] }) {
    const status = probe?.status ?? 'unknown';
    const tone = {
        healthy:  'border-emerald-200 bg-emerald-50',
        degraded: 'border-amber-200 bg-amber-50',
        critical: 'border-red-200 bg-red-50',
        down:     'border-red-300 bg-red-100',
        slow:     'border-amber-200 bg-amber-50',
        unknown:  'border-slate-200 bg-slate-50',
    }[status] ?? 'border-slate-200 bg-slate-50';
    const textTone = {
        healthy:  'text-emerald-700',
        degraded: 'text-amber-800',
        critical: 'text-red-700',
        down:     'text-red-700',
        slow:     'text-amber-800',
        unknown:  'text-slate-600',
    }[status] ?? 'text-slate-600';

    return (
        <div className={`p-4 border rounded-lg ${tone}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-600">
                    <Icon size={12} /> {title}
                </div>
                <span className={`text-xs font-medium uppercase ${textTone}`}>{status}</span>
            </div>
            <dl className="mt-3 space-y-1 text-xs">
                {extras.map(([k, v], i) => (
                    <div key={i} className="flex justify-between">
                        <dt className="text-slate-500">{k}</dt>
                        <dd className="font-medium text-slate-800">{v}</dd>
                    </div>
                ))}
            </dl>
            {probe?.error && <div className="mt-2 text-xs text-red-700 truncate" title={probe.error}>{probe.error}</div>}
        </div>
    );
}

function Row({ k, v }) {
    return (
        <div className="flex justify-between text-sm">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-medium text-slate-800">{v}</dd>
        </div>
    );
}
