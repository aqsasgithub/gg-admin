import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
    DollarSign, TrendingUp, TrendingDown, Globe, Wifi, Box, Activity,
    Database, Cloud, Loader2, AlertTriangle, Search,
} from 'lucide-react';
import {
    fetchCostOverview, fetchCostByCompany, fetchCostTrend,
    selectCostOverview, selectCostByCompany, selectCostTrend, selectCostsLoading,
} from '../features/admin/adminCostsSlice';
import useAdminPolling from '../hooks/useAdminPolling';

/**
 * Platform-wide cost analytics. Three sections:
 *   1. Top-line metric cards (billed / margin / tenants)
 *   2. Cost-by-category bar
 *   3. Top spenders + monthly trend
 *   4. Searchable per-company table
 */

const fmt = (cents) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function CostsPage() {
    const dispatch = useDispatch();
    const overview = useSelector(selectCostOverview);
    const trend    = useSelector(selectCostTrend);
    const byCo     = useSelector(selectCostByCompany);
    const loading  = useSelector(selectCostsLoading);

    const [sort,    setSort]    = useState('billed_desc');
    const [search,  setSearch]  = useState('');
    const [page,    setPage]    = useState(1);

    useEffect(() => { dispatch(fetchCostTrend({ months: 12 })); }, [dispatch]);
    useEffect(() => {
        dispatch(fetchCostByCompany({ sort, search: search || undefined, page, per_page: 50 }));
    }, [dispatch, sort, search, page]);

    useAdminPolling(() => dispatch(fetchCostOverview()), 30_000);

    return (
        <div className="p-6 space-y-5">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy">Cost analytics</h1>
                <p className="text-sm text-slate-600">
                    Platform-wide spend, tenant breakdowns, and margin analysis. Cost is computed from current entitlements; refresh updates every 30 seconds.
                </p>
            </header>

            {/* Top-line */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard icon={DollarSign} label="Billed (30d)"
                    value={overview ? fmt(overview.last_30_days.billed_cents) : '—'} />
                <MetricCard icon={Cloud} label="Provider cost (30d)"
                    value={overview ? fmt(overview.last_30_days.provider_cents) : '—'} />
                <MetricCard icon={TrendingUp} label="Margin (30d)"
                    value={overview ? fmt(overview.last_30_days.margin_cents) : '—'}
                    tone={(overview?.last_30_days.margin_cents ?? 0) < 0 ? 'critical' : 'good'} />
                <MetricCard icon={Activity} label="Active tenants (30d)"
                    value={overview?.last_30_days.active_tenants ?? '—'} />
            </div>

            {/* Cost-by-category bar */}
            {overview?.by_category && (
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
                        This month by category
                    </h2>
                    <CategoryBar by={overview.by_category} />
                </div>
            )}

            {/* Two-column: trend + top spenders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">12-month trend</h2>
                    <TrendChart data={trend} />
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">Top spenders (this month)</h2>
                    <ol className="space-y-1.5 text-sm">
                        {(overview?.top_spenders ?? []).map((t, i) => (
                            <li key={t.company_id}
                                className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50">
                                <Link to={`/companies/${t.company_id}?tab=costs`}
                                    className="flex items-center gap-2 min-w-0">
                                    <span className="text-slate-400 text-xs w-5">{i + 1}.</span>
                                    <span className="font-medium text-guardian-navy truncate">{t.company_name}</span>
                                    <span className="text-xs text-slate-500 ml-1 whitespace-nowrap">
                                        <Globe size={9} className="inline mr-0.5" />{t.domain_count}{' '}
                                        <Wifi size={9} className="inline ml-1 mr-0.5" />{t.asset_count}
                                    </span>
                                </Link>
                                <div className="flex flex-col items-end shrink-0 ml-2">
                                    <span className="font-mono font-medium">{fmt(t.billed_cents)}</span>
                                    <span className={`text-xs ${t.margin_cents < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {t.margin_cents < 0 ? '−' : '+'}{fmt(Math.abs(t.margin_cents))} margin
                                    </span>
                                </div>
                            </li>
                        ))}
                        {(!overview?.top_spenders || overview.top_spenders.length === 0) && (
                            <li className="text-center py-6 text-slate-500 text-sm">
                                No tenant cost data yet. The costs:rollup command needs to run.
                            </li>
                        )}
                    </ol>
                </div>
            </div>

            {/* All companies table */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-slate-900">All tenants</h2>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-2 text-slate-400" />
                            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                placeholder="Search by company..."
                                className="pl-7 pr-2 py-1 text-sm border border-slate-300 rounded-md" />
                        </div>
                        <select value={sort} onChange={(e) => setSort(e.target.value)}
                            className="px-2 py-1 text-sm border border-slate-300 rounded-md">
                            <option value="billed_desc">Highest billed</option>
                            <option value="billed_asc">Lowest billed</option>
                            <option value="margin_desc">Highest margin</option>
                            <option value="margin_asc">Lowest margin (incl. negative)</option>
                            <option value="domains_desc">Most domains</option>
                            <option value="assets_desc">Most assets</option>
                        </select>
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-3 py-2 text-left">Company</th>
                                <th className="px-3 py-2 text-left">Plan</th>
                                <th className="px-3 py-2 text-right">Domains</th>
                                <th className="px-3 py-2 text-right">Assets</th>
                                <th className="px-3 py-2 text-right">API calls</th>
                                <th className="px-3 py-2 text-right">Billed</th>
                                <th className="px-3 py-2 text-right">Provider</th>
                                <th className="px-3 py-2 text-right">Margin</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && !byCo.list.length ? (
                                <tr><td colSpan="8" className="px-3 py-8 text-center text-slate-500">
                                    <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                                </td></tr>
                            ) : !byCo.list.length ? (
                                <tr><td colSpan="8" className="px-3 py-8 text-center text-slate-500">
                                    No tenant cost data for the selected month.
                                </td></tr>
                            ) : byCo.list.map((c) => (
                                <tr key={c.id}>
                                    <td className="px-3 py-2.5">
                                        <Link to={`/companies/${c.company_id}?tab=costs`}
                                            className="font-medium text-guardian-navy hover:underline">
                                            {c.company?.name ?? c.company_id}
                                        </Link>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs">
                                        <span className="px-1.5 py-0.5 bg-slate-100 rounded uppercase">
                                            {c.pricing_plan_key ?? 'none'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono text-xs">{c.domain_count}</td>
                                    <td className="px-3 py-2.5 text-right font-mono text-xs">{c.asset_count}</td>
                                    <td className="px-3 py-2.5 text-right font-mono text-xs">{c.api_call_count?.toLocaleString() ?? 0}</td>
                                    <td className="px-3 py-2.5 text-right font-mono">{fmt(c.total_billed_cents)}</td>
                                    <td className="px-3 py-2.5 text-right font-mono text-slate-500">{fmt(c.total_provider_cents)}</td>
                                    <td className={`px-3 py-2.5 text-right font-mono font-medium ${c.total_margin_cents < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {c.total_margin_cents < 0 ? '−' : ''}{fmt(Math.abs(c.total_margin_cents))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {byCo.meta && byCo.meta.last_page > 1 && (
                        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-sm">
                            <div className="text-slate-600">Page {byCo.meta.current_page} of {byCo.meta.last_page} · {byCo.meta.total} tenants</div>
                            <div className="flex gap-1">
                                <button type="button" disabled={byCo.meta.current_page <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                    className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40">Previous</button>
                                <button type="button" disabled={byCo.meta.current_page >= byCo.meta.last_page}
                                    onClick={() => setPage((p) => p + 1)}
                                    className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40">Next</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, tone = 'default' }) {
    const tones = {
        good:     'text-emerald-600',
        critical: 'text-red-600',
        default:  'text-guardian-navy',
    };
    return (
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Icon size={12} /> {label}
            </div>
            <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
        </div>
    );
}

function CategoryBar({ by }) {
    const items = [
        { key: 'base',      label: 'Base',      cents: by.base_cents,      color: 'bg-slate-500' },
        { key: 'domain',    label: 'Domains',   cents: by.domain_cents,    color: 'bg-sky-500' },
        { key: 'asset',     label: 'Assets',    cents: by.asset_cents,     color: 'bg-cyan-500' },
        { key: 'module',    label: 'Modules',   cents: by.module_cents,    color: 'bg-violet-500' },
        { key: 'api',       label: 'API calls', cents: by.api_call_cents,  color: 'bg-amber-500' },
        { key: 'storage',   label: 'Storage',   cents: by.storage_cents,   color: 'bg-emerald-500' },
        { key: 'bandwidth', label: 'Bandwidth', cents: by.bandwidth_cents, color: 'bg-rose-500' },
    ];
    const total = items.reduce((s, x) => s + x.cents, 0);
    if (total === 0) return <div className="text-sm text-slate-500">No cost data for this month yet.</div>;

    return (
        <>
            <div className="flex h-4 rounded-full overflow-hidden bg-slate-100">
                {items.map((i) => i.cents > 0 && (
                    <div key={i.key} className={i.color} style={{ width: `${(i.cents / total) * 100}%` }}
                         title={`${i.label}: ${fmt(i.cents)}`} />
                ))}
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                {items.map((i) => (
                    <div key={i.key} className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${i.color}`} />
                        <span className="text-slate-700">{i.label}</span>
                        <span className="ml-auto font-mono">{fmt(i.cents)}</span>
                    </div>
                ))}
            </div>
        </>
    );
}

function TrendChart({ data }) {
    if (!data?.length) return <div className="text-sm text-slate-500 text-center py-8">No trend data.</div>;

    const max = Math.max(...data.map((d) => d.billed_cents), 1);
    return (
        <div className="space-y-1">
            <div className="flex items-end gap-1 h-32">
                {data.map((row) => {
                    const billedPct   = (row.billed_cents / max) * 100;
                    const providerPct = (row.provider_cents / max) * 100;
                    return (
                        <div key={`${row.period_year}-${row.period_month}`}
                            className="flex-1 flex flex-col items-center gap-0.5 group relative">
                            <div className="w-full relative" style={{ height: `${billedPct}%` }}>
                                <div className="absolute inset-0 bg-guardian-navy/70 rounded-t" />
                                <div className="absolute bottom-0 left-0 right-0 bg-slate-400/60 rounded-t"
                                    style={{ height: `${(providerPct / billedPct) * 100}%` }} />
                            </div>
                            <span className="absolute -bottom-5 text-[10px] text-slate-500">
                                {MONTHS[row.period_month - 1]}
                            </span>
                            <div className="hidden group-hover:block absolute -top-12 left-1/2 -translate-x-1/2 z-10 bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                                {MONTHS[row.period_month - 1]} {row.period_year}: <strong>{fmt(row.billed_cents)}</strong>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 pt-4">
                <span>oldest</span>
                <span className="flex items-center gap-3">
                    <span><span className="inline-block w-2 h-2 bg-guardian-navy/70 mr-0.5 align-middle" /> billed</span>
                    <span><span className="inline-block w-2 h-2 bg-slate-400/60 mr-0.5 align-middle" /> provider</span>
                </span>
                <span>now</span>
            </div>
        </div>
    );
}
