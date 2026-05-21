import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Sword, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchCompanyTakedowns, selectCompanyTakedowns,
} from '../../features/admin/adminTakedownsSlice';
import { TakedownStatusPill, SeverityPill } from '../../pages/TakedownsPage';

export default function CompanyTakedownsTab({ companyId }) {
    const dispatch = useDispatch();
    const list = useSelector((s) => selectCompanyTakedowns(s, companyId));

    useEffect(() => { dispatch(fetchCompanyTakedowns({ companyId, per_page: 100 })); }, [dispatch, companyId]);

    return (
        <div className="space-y-4">
            <header>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Sword size={16} /> Takedowns
                </h2>
                <p className="text-sm text-slate-500">
                    Takedown cases for this tenant — both customer-opened and admin-opened.
                </p>
            </header>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Case</th>
                            <th className="px-3 py-2 text-left">Target</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Severity</th>
                            <th className="px-3 py-2 text-left">Abuse kind</th>
                            <th className="px-3 py-2 text-left">SLA</th>
                            <th className="px-3 py-2 text-left">Opened</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {!list ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">
                                No takedown cases for this tenant.
                            </td></tr>
                        ) : list.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2.5">
                                    <Link to={`/takedowns/${c.id}`} className="font-mono text-xs text-guardian-navy hover:underline">
                                        {c.id}
                                    </Link>
                                </td>
                                <td className="px-3 py-2.5 text-xs">
                                    {c.primary_target
                                        ? <code className="text-slate-700 truncate inline-block max-w-xs">{c.primary_target}</code>
                                        : <span className="italic text-slate-400">no target</span>}
                                </td>
                                <td className="px-3 py-2.5"><TakedownStatusPill status={c.status} /></td>
                                <td className="px-3 py-2.5"><SeverityPill severity={c.severity} /></td>
                                <td className="px-3 py-2.5 text-xs text-slate-700 capitalize">
                                    {c.abuse_kind?.replace(/_/g, ' ') ?? '—'}
                                </td>
                                <td className="px-3 py-2.5">
                                    {c.sla_due_at ? (
                                        <span className={`inline-flex items-center gap-1 text-xs ${c.sla_breached ? 'text-red-700 font-semibold' : 'text-slate-600'}`}>
                                            {c.sla_breached
                                                ? <AlertTriangle size={11} />
                                                : <Clock size={11} className="text-slate-400" />}
                                            {c.sla_hours_remaining < 0
                                                ? `${Math.abs(c.sla_hours_remaining)}h over`
                                                : `${c.sla_hours_remaining}h left`}
                                        </span>
                                    ) : <span className="text-xs text-slate-400">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">
                                    {c.created_at ? formatDistanceToNow(parseISO(c.created_at), { addSuffix: true }) : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
