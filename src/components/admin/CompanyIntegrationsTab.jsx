import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plug, Loader2, Check, X, Pause, Power } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchCompanyIntegrations,
    enableIntegration, disableIntegration, disconnectIntegration,
    selectCompanyIntegrations,
} from '../../features/admin/adminIntegrationsSlice';

export default function CompanyIntegrationsTab({ companyId }) {
    const dispatch = useDispatch();
    const list = useSelector((s) => selectCompanyIntegrations(s, companyId));
    const [action, setAction] = useState(null);

    useEffect(() => { dispatch(fetchCompanyIntegrations(companyId)); }, [dispatch, companyId]);

    return (
        <div className="space-y-4">
            <header>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Plug size={16} /> Integrations
                </h2>
                <p className="text-sm text-slate-500">External integrations connected by this tenant.</p>
            </header>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Integration</th>
                            <th className="px-3 py-2 text-center">State</th>
                            <th className="px-3 py-2 text-left">Last used</th>
                            <th className="px-3 py-2 text-left">Failures</th>
                            <th className="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {!list ? (
                            <tr><td colSpan="5" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="5" className="px-3 py-8 text-center text-slate-500">No integrations.</td></tr>
                        ) : list.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2.5">
                                    <div className="font-medium capitalize">{c.integration}</div>
                                    {c.display_name && <div className="text-xs text-slate-500">{c.display_name}</div>}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                    {c.enabled
                                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full"><Check size={10} /> enabled</span>
                                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full"><X size={10} /> disabled</span>}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">
                                    {c.last_used_at ? formatDistanceToNow(parseISO(c.last_used_at), { addSuffix: true }) : 'never'}
                                </td>
                                <td className="px-3 py-2.5 text-xs">
                                    {c.failure_count > 0
                                        ? <span className="text-red-700 font-semibold">{c.failure_count}</span>
                                        : <span className="text-slate-400">0</span>}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                    <div className="inline-flex items-center gap-1">
                                        {c.enabled
                                            ? <button type="button" onClick={() => setAction({ kind: 'disable', i: c })}
                                                className="px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 rounded">
                                                <Pause size={11} className="inline mr-0.5" /> Disable</button>
                                            : <button type="button" onClick={() => setAction({ kind: 'enable', i: c })}
                                                className="px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 rounded">
                                                <Check size={11} className="inline mr-0.5" /> Enable</button>}
                                        <button type="button" onClick={() => setAction({ kind: 'disconnect', i: c })}
                                            className="px-2 py-1 text-xs text-red-700 hover:bg-red-50 rounded">
                                            <Power size={11} className="inline mr-0.5" /> Disconnect</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {action && <Modal action={action} onClose={() => setAction(null)} onConfirm={async (reason) => {
                if (action.kind === 'enable')     await dispatch(enableIntegration(action.i.id));
                if (action.kind === 'disable')    await dispatch(disableIntegration({ id: action.i.id, reason }));
                if (action.kind === 'disconnect') await dispatch(disconnectIntegration({ id: action.i.id, reason }));
                setAction(null);
                dispatch(fetchCompanyIntegrations(companyId));
            }} />}
        </div>
    );
}

function Modal({ action, onClose, onConfirm }) {
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const needsReason = action.kind !== 'enable';
    const minLen = action.kind === 'disconnect' ? 10 : 5;
    const valid = !needsReason || reason.length >= minLen;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h3 className="text-base font-semibold capitalize">
                        {action.kind} {action.i.integration}
                    </h3>
                </div>
                <div className="p-5">
                    {needsReason && (
                        <>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Reason (≥{minLen} chars)</label>
                            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                                className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                        </>
                    )}
                </div>
                <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-700">Cancel</button>
                    <button type="button" disabled={!valid || busy}
                        onClick={async () => { setBusy(true); try { await onConfirm(reason); } finally { setBusy(false); } }}
                        className={`px-3 py-1.5 text-sm font-medium text-white rounded-md disabled:opacity-50 ${
                            action.kind === 'disconnect' ? 'bg-red-600 hover:bg-red-700' : 'bg-guardian-navy hover:bg-guardian-navy-800'
                        }`}>
                        {busy ? 'Working…' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}
