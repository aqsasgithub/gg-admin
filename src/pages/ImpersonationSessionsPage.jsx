import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { UserCheck, Loader2, ExternalLink, Square } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchImpersonationSessions, endImpersonation, selectImpersonationSessions, selectImpersonationLoading,
} from '../features/admin/adminImpersonationSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';

export default function ImpersonationSessionsPage() {
    const dispatch = useDispatch();
    const list    = useSelector(selectImpersonationSessions);
    const loading = useSelector(selectImpersonationLoading);

    const [filters, setFilters] = useState({ active_only: '1' });
    const [confirm, setConfirm] = useState(null);

    useEffect(() => {
        dispatch(fetchImpersonationSessions({ ...filters, per_page: 100 }));
    }, [dispatch, filters]);

    const active = list.filter((s) => s.is_active);

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy">Impersonation sessions</h1>
                <p className="text-sm text-slate-600">
                    Active and historical "login as customer" sessions. Sessions auto-expire by JWT TTL;
                    ending one early invalidates the token immediately.
                </p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Stat label="Active sessions" value={active.length} tone={active.length ? 'critical' : 'default'} />
                <Stat label="Total tracked"   value={list.length} />
                <Stat label="Ended today"     value={list.filter((s) => s.ended_at &&
                    parseISO(s.ended_at) > new Date(Date.now() - 86400_000)).length} />
            </div>

            <AdminFilterBar
                filters={[
                    { key: 'admin_id',  type: 'text', label: 'Admin user',  placeholder: 'usr_... (the impersonator)' },
                    { key: 'target_id', type: 'text', label: 'Target user', placeholder: 'usr_... (impersonated)' },
                    { key: 'active_only', type: 'select', label: 'Show',
                      options: [{ value: '1', label: 'Active only' }, { value: '0', label: 'All' }] },
                ]}
                value={filters}
                onChange={setFilters}
                onClear={() => setFilters({ active_only: '1' })}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Session</th>
                            <th className="px-3 py-2 text-left">Admin</th>
                            <th className="px-3 py-2 text-left">Target</th>
                            <th className="px-3 py-2 text-left">Started</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Reason</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !list.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">No sessions to show.</td></tr>
                        ) : list.map((s) => (
                            <tr key={s.id} className={s.is_active ? 'bg-amber-50/30' : ''}>
                                <td className="px-3 py-2.5">
                                    <code className="text-xs font-mono text-slate-700">{s.id}</code>
                                </td>
                                <td className="px-3 py-2.5 text-xs">
                                    {s.admin?.email ?? <code>{s.admin_user_id}</code>}
                                </td>
                                <td className="px-3 py-2.5 text-xs">
                                    {s.target?.email ?? <code>{s.target_user_id}</code>}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">
                                    {formatDistanceToNow(parseISO(s.started_at), { addSuffix: true })}
                                </td>
                                <td className="px-3 py-2.5">
                                    {s.is_active ? (
                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">Active</span>
                                    ) : (
                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                                            Ended ({s.end_reason ?? '—'})
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-600 max-w-xs truncate" title={s.reason}>
                                    {s.reason}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                    {s.is_active && (
                                        <button type="button" onClick={() => setConfirm({ session: s })}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">
                                            <Square size={12} /> End
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AdminConfirmModal open={!!confirm}
                title={`End impersonation session ${confirm?.session?.id}?`}
                description="The session token is invalidated immediately. The admin will be logged out of the customer view."
                confirmLabel="End session" variant="destructive"
                onCancel={() => setConfirm(null)}
                onConfirm={async () => {
                    await dispatch(endImpersonation(confirm.session.id));
                    setConfirm(null);
                    dispatch(fetchImpersonationSessions({ ...filters, per_page: 100 }));
                }} />
        </div>
    );
}

function Stat({ label, value, tone = 'default' }) {
    const tones = { critical: 'text-amber-700', default: 'text-guardian-navy' };
    return (
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
        </div>
    );
}
