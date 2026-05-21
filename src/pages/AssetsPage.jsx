import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Wifi, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
    fetchAssets, fetchAssetStats,
    selectAssets, selectAssetsMeta, selectAssetsLoading, selectAssetStats,
} from '../features/admin/adminAssetsSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';

export default function AssetsPage() {
    const dispatch = useDispatch();
    const list     = useSelector(selectAssets);
    const meta     = useSelector(selectAssetsMeta);
    const loading  = useSelector(selectAssetsLoading);
    const stats    = useSelector(selectAssetStats);

    const [filters, setFilters] = useState({});
    const [page,    setPage]    = useState(1);

    useEffect(() => { dispatch(fetchAssets({ ...filters, page, per_page: 50 })); }, [dispatch, filters, page]);
    useEffect(() => { dispatch(fetchAssetStats()); }, [dispatch]);

    const typeOptions = stats?.by_type
        ? Object.keys(stats.by_type).map((t) => ({ value: t, label: t }))
        : [];

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                    <Wifi size={22} /> Assets
                </h1>
                <p className="text-sm text-slate-600">
                    Cross-tenant asset inventory. Read-only — the customer-side scanner pipeline owns asset writes.
                </p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Total assets" value={stats?.total ?? '—'} />
                <Stat label="Tenants with assets" value={stats?.top_companies?.length ?? '—'} />
                <Stat label="Asset types"  value={stats?.by_type ? Object.keys(stats.by_type).length : '—'} />
                <Stat label="High value"   value={stats?.by_value_tier?.high ?? '—'} />
            </div>

            <AdminFilterBar
                filters={[
                    { key: 'search',     type: 'text',   label: 'Search', placeholder: 'ID, hostname…' },
                    { key: 'type',       type: 'select', label: 'Type',   options: typeOptions },
                    { key: 'value_tier', type: 'text',   label: 'Value tier', placeholder: 'high / medium / low' },
                ]}
                value={filters}
                onChange={(v) => { setFilters(v); setPage(1); }}
                onClear={() => { setFilters({}); setPage(1); }}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Asset</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Hostname</th>
                            <th className="px-3 py-2 text-left">Value tier</th>
                            <th className="px-3 py-2 text-left">Company</th>
                            <th className="px-3 py-2 text-left">Created</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !list.length ? (
                            <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">No assets match.</td></tr>
                        ) : list.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2.5 font-mono text-xs">{a.id}</td>
                                <td className="px-3 py-2.5 text-xs">{a.type}</td>
                                <td className="px-3 py-2.5 text-xs"><code>{a.hostname ?? '—'}</code></td>
                                <td className="px-3 py-2.5 text-xs">
                                    {a.value_tier ? <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 uppercase text-[10px]">{a.value_tier}</span> : '—'}
                                </td>
                                <td className="px-3 py-2.5">
                                    <Link to={`/companies/${a.company_id}?tab=assets`} className="text-xs font-mono text-slate-700 hover:underline">
                                        {a.company_id}
                                    </Link>
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">
                                    {a.created_at ? format(parseISO(a.created_at), 'MMM d, yyyy') : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {meta && meta.last_page > 1 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-sm">
                        <div className="text-slate-600">Page {meta.current_page} of {meta.last_page} · {meta.total}</div>
                        <div className="flex gap-1">
                            <button type="button" disabled={meta.current_page <= 1}
                                onClick={() => setPage((p) => p - 1)} className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40">Previous</button>
                            <button type="button" disabled={meta.current_page >= meta.last_page}
                                onClick={() => setPage((p) => p + 1)} className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40">Next</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function Stat({ label, value }) {
    return (
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-0.5 text-xl font-semibold text-guardian-navy">{value}</div>
        </div>
    );
}
