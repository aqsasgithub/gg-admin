import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Wifi, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fetchCompanyAssets, selectCompanyAssets } from '../../features/admin/adminAssetsSlice';

export default function CompanyAssetsTab({ companyId }) {
    const dispatch = useDispatch();
    const list = useSelector((s) => selectCompanyAssets(s, companyId));

    useEffect(() => { dispatch(fetchCompanyAssets({ companyId, per_page: 200 })); }, [dispatch, companyId]);

    return (
        <div className="space-y-4">
            <header>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Wifi size={16} /> Assets
                </h2>
                <p className="text-sm text-slate-500">
                    Asset inventory for this tenant. Read-only — the customer-side scanner pipeline owns asset writes.
                </p>
            </header>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">ID</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Hostname</th>
                            <th className="px-3 py-2 text-left">Value tier</th>
                            <th className="px-3 py-2 text-left">Created</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {!list ? (
                            <tr><td colSpan="5" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="5" className="px-3 py-8 text-center text-slate-500">No assets recorded for this tenant.</td></tr>
                        ) : list.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2.5 font-mono text-xs">{a.id}</td>
                                <td className="px-3 py-2.5 text-xs">{a.type}</td>
                                <td className="px-3 py-2.5 text-xs"><code>{a.hostname ?? '—'}</code></td>
                                <td className="px-3 py-2.5 text-xs">
                                    {a.value_tier
                                        ? <span className="px-1.5 py-0.5 bg-slate-100 rounded uppercase text-[10px]">{a.value_tier}</span>
                                        : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">
                                    {a.created_at ? format(parseISO(a.created_at), 'MMM d, yyyy') : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
