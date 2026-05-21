import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Gauge, Plus, Trash2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchCompanyRateLimits, setRateLimit, removeRateLimit,
    selectCompanyRateLimits,
} from '../../features/admin/adminRateLimitsSlice';
import AdminConfirmModal from './AdminConfirmModal';

const BUCKETS = ['api', 'scan', 'login'];

export default function CompanyRateLimitsTab({ company }) {
    const dispatch = useDispatch();
    const list = useSelector((s) => selectCompanyRateLimits(s, company.id));
    const [editing, setEditing] = useState(null);
    const [confirmRemove, setConfirmRemove] = useState(null);

    useEffect(() => { dispatch(fetchCompanyRateLimits(company.id)); }, [dispatch, company.id]);

    return (
        <div className="space-y-4">
            <header className="flex items-start justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <Gauge size={16} /> Rate-limit overrides
                    </h2>
                    <p className="text-sm text-slate-500">
                        Per-tenant rate limit overrides for {company.name}. Default platform limits apply where no override is set.
                    </p>
                </div>
                <button type="button" onClick={() => setEditing({})}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-guardian-navy hover:bg-guardian-navy-800 text-white text-sm rounded-md">
                    <Plus size={12} /> New override
                </button>
            </header>

            {list.length === 0 ? (
                <div className="p-6 bg-white border border-slate-200 rounded text-sm text-slate-500 text-center">
                    No rate-limit overrides. Platform defaults apply.
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-3 py-2 text-left">Bucket</th>
                                <th className="px-3 py-2 text-left">Limit (per min)</th>
                                <th className="px-3 py-2 text-left">Reason</th>
                                <th className="px-3 py-2 text-left">Expires</th>
                                <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {list.map((r) => (
                                <tr key={r.id}>
                                    <td className="px-3 py-2.5 text-sm capitalize">{r.bucket}</td>
                                    <td className="px-3 py-2.5 text-sm font-mono">{r.limit_per_minute}</td>
                                    <td className="px-3 py-2.5 text-xs text-slate-600 max-w-xs truncate" title={r.reason}>{r.reason ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-xs text-slate-500">
                                        {r.expires_at ? formatDistanceToNow(parseISO(r.expires_at), { addSuffix: true }) : 'Never'}
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <button type="button" onClick={() => setConfirmRemove(r)}
                                            className="p-1.5 rounded text-red-600 hover:bg-red-50" title="Remove">
                                            <Trash2 size={12} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {editing && (
                <EditModal onClose={() => setEditing(null)}
                    onSubmit={async (payload) => {
                        await dispatch(setRateLimit({ companyId: company.id, ...payload }));
                        setEditing(null);
                    }} />
            )}

            <AdminConfirmModal open={!!confirmRemove}
                title={`Remove ${confirmRemove?.bucket} rate-limit override?`}
                description="Platform defaults will apply once removed."
                confirmLabel="Remove" variant="destructive"
                onCancel={() => setConfirmRemove(null)}
                onConfirm={async () => {
                    await dispatch(removeRateLimit({ overrideId: confirmRemove.id, companyId: company.id }));
                    setConfirmRemove(null);
                }} />
        </div>
    );
}

function EditModal({ onClose, onSubmit }) {
    const [bucket, setBucket] = useState('api');
    const [limit,  setLimit]  = useState(60);
    const [reason, setReason] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [busy, setBusy] = useState(false);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold">New rate-limit override</h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Bucket</label>
                            <select value={bucket} onChange={(e) => setBucket(e.target.value)}
                                className="w-full p-2 text-sm border border-slate-300 rounded-md">
                                {BUCKETS.map((b) => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Limit / minute</label>
                            <input type="number" min="1" value={limit} onChange={(e) => setLimit(Number(e.target.value))}
                                className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Reason</label>
                        <input value={reason} onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Enterprise tier expanded quota"
                            className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Expires at (optional)</label>
                        <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                            className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm">Cancel</button>
                        <button type="button" disabled={busy || !limit}
                            onClick={async () => { setBusy(true); try { await onSubmit({ bucket, limitPerMinute: limit, reason, expiresAt: expiresAt || null }); } finally { setBusy(false); } }}
                            className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50 text-white rounded-md">
                            {busy ? 'Saving…' : 'Apply override'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
