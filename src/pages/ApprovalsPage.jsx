import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ClipboardCheck, Loader2, Check, X } from 'lucide-react';
import {
    fetchApprovals, decideApproval,
    selectApprovals, selectApprovalsMeta, selectApprovalsLoading, selectApprovalsActing,
} from '../features/admin/adminApprovalsSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';

const RISK_BADGE = {
    low: 'bg-slate-100 text-slate-700',
    medium: 'bg-amber-100 text-amber-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
};
const STATUS_BADGE = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
    cancelled: 'bg-slate-100 text-slate-600',
    applied: 'bg-blue-100 text-blue-800',
    expired: 'bg-slate-100 text-slate-500',
};

export default function ApprovalsPage() {
    const dispatch = useDispatch();
    const list    = useSelector(selectApprovals);
    const meta    = useSelector(selectApprovalsMeta);
    const loading = useSelector(selectApprovalsLoading);
    const acting  = useSelector(selectApprovalsActing);

    const [filters, setFilters] = useState({ status: 'pending' });

    const reload = () => dispatch(fetchApprovals(filters));
    useEffect(() => { reload(); }, [dispatch, JSON.stringify(filters)]);

    const decide = async (id, action) => {
        await dispatch(decideApproval({ id, action }));
        reload();
    };

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                    <ClipboardCheck size={22} /> Approvals
                </h1>
                <p className="text-sm text-slate-600 max-w-3xl">
                    High-risk admin actions — critical-finding suppression, major score changes, global API disable, scan
                    archival, takedown force-close — are queued here for a second admin to review. You cannot approve your
                    own request.
                </p>
            </header>

            <AdminFilterBar
                filters={[
                    { key: 'status', type: 'select', label: 'Status', options: [
                        { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' },
                        { value: 'rejected', label: 'Rejected' }, { value: 'applied', label: 'Applied' } ] },
                    { key: 'risk_level', type: 'select', label: 'Risk', options: [
                        { value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' },
                        { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' } ] },
                ]}
                value={filters}
                onChange={setFilters}
                onClear={() => setFilters({})}
            />

            {meta?.pending != null && (
                <div className="text-sm text-slate-500">{meta.pending} pending approval(s).</div>
            )}

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                        <tr>
                            <th className="text-left px-3 py-2">Action</th>
                            <th className="text-left px-3 py-2">Target</th>
                            <th className="text-left px-3 py-2">Risk</th>
                            <th className="text-left px-3 py-2">Status</th>
                            <th className="text-left px-3 py-2">Requested</th>
                            <th className="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400"><Loader2 className="inline animate-spin mr-2" size={16} /> Loading…</td></tr>}
                        {!loading && list.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">Nothing in the queue.</td></tr>}
                        {!loading && list.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2">
                                    <div className="font-medium text-slate-800">{a.action_type}</div>
                                    {a.reason && <div className="text-xs text-slate-400 truncate max-w-xs">{a.reason}</div>}
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-500">{a.target_type} {a.target_id}</td>
                                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${RISK_BADGE[a.risk_level] || 'bg-slate-100'}`}>{a.risk_level}</span></td>
                                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_BADGE[a.approval_status] || 'bg-slate-100'}`}>{a.approval_status}</span></td>
                                <td className="px-3 py-2 text-xs text-slate-400">{a.requested_at ? new Date(a.requested_at).toLocaleString() : ''}</td>
                                <td className="px-3 py-2 text-right">
                                    {a.approval_status === 'pending' && (
                                        <div className="inline-flex gap-1">
                                            <button onClick={() => decide(a.id, 'approve')} disabled={acting}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-700 disabled:opacity-50"><Check size={12} /> Approve</button>
                                            <button onClick={() => decide(a.id, 'reject')} disabled={acting}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700 disabled:opacity-50"><X size={12} /> Reject</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
