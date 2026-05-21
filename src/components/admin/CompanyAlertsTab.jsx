import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fetchCompanyAlerts, selectCompanyAlerts } from '../../features/admin/adminAlertsSlice';
import { AlertStatusPill, AlertSeverityPill } from '../../pages/AlertsPage';

export default function CompanyAlertsTab({ companyId }) {
    const dispatch = useDispatch();
    const list = useSelector((s) => selectCompanyAlerts(s, companyId));

    useEffect(() => { dispatch(fetchCompanyAlerts({ companyId, per_page: 100 })); }, [dispatch, companyId]);

    return (
        <div className="space-y-4">
            <header>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <AlertTriangle size={16} /> Alerts
                </h2>
                <p className="text-sm text-slate-500">Persistent alert identities for this tenant.</p>
            </header>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Alert</th>
                            <th className="px-3 py-2 text-left">Module</th>
                            <th className="px-3 py-2 text-left">Severity</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Last seen</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {!list ? (
                            <tr><td colSpan="5" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="5" className="px-3 py-8 text-center text-slate-500">No alerts for this tenant.</td></tr>
                        ) : list.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2.5">
                                    <Link to={`/alerts/${a.id}`} className="font-medium text-guardian-navy hover:underline">
                                        {a.title}
                                    </Link>
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-700">{a.module}</td>
                                <td className="px-3 py-2.5"><AlertSeverityPill severity={a.severity} /></td>
                                <td className="px-3 py-2.5"><AlertStatusPill status={a.status} /></td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">
                                    {a.last_seen_at ? formatDistanceToNow(parseISO(a.last_seen_at), { addSuffix: true }) : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
