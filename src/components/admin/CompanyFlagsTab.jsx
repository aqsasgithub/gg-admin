import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Flag, Loader2 } from 'lucide-react';
import {
    fetchCompanyFlags, overrideCompanyFlag, clearCompanyFlagOverride,
    selectCompanyFlags,
} from '../../features/admin/adminFlagsSlice';

export default function CompanyFlagsTab({ company }) {
    const dispatch = useDispatch();
    const flags = useSelector((s) => selectCompanyFlags(s, company.id));
    const [editing, setEditing] = useState(null);

    useEffect(() => { dispatch(fetchCompanyFlags(company.id)); }, [dispatch, company.id]);

    return (
        <div className="space-y-4">
            <header>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <Flag size={16} /> Feature flags
                </h2>
                <p className="text-sm text-slate-500">
                    Per-tenant flag overrides for {company.name}. Without an override, the platform default applies.
                </p>
            </header>

            {flags.length === 0 ? (
                <div className="p-6 bg-white border border-slate-200 rounded text-sm text-slate-500 text-center">
                    No flags defined yet. Create flags from the Flags page.
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-3 py-2 text-left">Key</th>
                                <th className="px-3 py-2 text-left">Default</th>
                                <th className="px-3 py-2 text-left">Override</th>
                                <th className="px-3 py-2 text-left">Resolved</th>
                                <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {flags.map((f) => (
                                <tr key={f.key}>
                                    <td className="px-3 py-2.5">
                                        <div className="font-mono text-xs">{f.key}</div>
                                        <div className="text-xs text-slate-500">{f.label}</div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <BoolPill on={f.default_enabled} />
                                    </td>
                                    <td className="px-3 py-2.5">
                                        {f.has_override ? <BoolPill on={f.override_enabled} forced /> :
                                            <span className="text-xs text-slate-400">—</span>}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <BoolPill on={f.resolved} />
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <button type="button" onClick={() => setEditing(f)}
                                            className="text-xs text-guardian-navy hover:underline">
                                            {f.has_override ? 'Edit' : 'Override'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {editing && (
                <OverrideModal flag={editing}
                    onClose={() => setEditing(null)}
                    onApply={async ({ enabled, reason }) => {
                        await dispatch(overrideCompanyFlag({ companyId: company.id, key: editing.key, enabled, reason }));
                        setEditing(null);
                    }}
                    onClear={async () => {
                        await dispatch(clearCompanyFlagOverride({ companyId: company.id, key: editing.key }));
                        setEditing(null);
                    }} />
            )}
        </div>
    );
}

function BoolPill({ on, forced = false }) {
    const cls = on
        ? `bg-emerald-100 text-emerald-700 ${forced ? 'ring-1 ring-emerald-300' : ''}`
        : `bg-slate-100 text-slate-600 ${forced ? 'ring-1 ring-slate-300' : ''}`;
    return <span className={`px-2 py-0.5 text-xs rounded-full ${cls}`}>{on ? 'on' : 'off'}</span>;
}

function OverrideModal({ flag, onClose, onApply, onClear }) {
    const [enabled, setEnabled] = useState(flag.has_override ? flag.override_enabled : !flag.default_enabled);
    const [reason, setReason] = useState(flag.reason ?? '');
    const [busy, setBusy] = useState(false);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold">Override <code className="font-mono text-sm">{flag.key}</code></h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="p-5 space-y-3">
                    <div className="text-xs text-slate-500">
                        Platform default: <strong>{flag.default_enabled ? 'on' : 'off'}</strong>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Override state</label>
                        <select value={enabled ? '1' : '0'} onChange={(e) => setEnabled(e.target.value === '1')}
                            className="w-full p-2 text-sm border border-slate-300 rounded-md">
                            <option value="1">On</option>
                            <option value="0">Off</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Reason</label>
                        <input value={reason} onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Enterprise early access"
                            className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        {flag.has_override && (
                            <button type="button" onClick={async () => { setBusy(true); try { await onClear(); } finally { setBusy(false); } }}
                                disabled={busy}
                                className="text-xs text-red-600 hover:underline">
                                Remove override
                            </button>
                        )}
                        <div className="ml-auto flex gap-2">
                            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm">Cancel</button>
                            <button type="button" disabled={busy}
                                onClick={async () => { setBusy(true); try { await onApply({ enabled, reason }); } finally { setBusy(false); } }}
                                className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50 text-white rounded-md">
                                {busy ? 'Saving…' : 'Apply override'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
