import { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Plus, Trash2, Save, X, Pencil, Loader2, Server, Info } from 'lucide-react';
import {
    addNetworkTarget,
    updateNetworkTarget,
    removeNetworkTarget,
} from '../../features/admin/adminDomainsSlice';
import { validateTargetIp } from '../../utils/ipValidation';

const targetOf = (domain) => (domain?.network_targets || [])[0] || null;

/**
 * Admin management of Network Security target IPs for a company's domains.
 *
 *      Company → Domain → Target IP   (at most one per domain)
 *
 * Mirrors the customer portal exactly: adding uses a dropdown limited to
 * domains that don't already have a target IP, and all writes go through the
 * same shared NetworkTargetService server-side, so validation and the
 * one-per-domain rule cannot drift between the two portals.
 *
 * CONFIGURATION ONLY — saving never starts an assessment, creates results, or
 * marks a domain as scanned.
 */
export default function NetworkTargetsPanel({ companyId, domains = [] }) {
    const dispatch = useDispatch();

    const [adding, setAdding] = useState(false);
    const [newDomainId, setNewDomainId] = useState('');
    const [newIp, setNewIp] = useState('');
    const [addError, setAddError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [editIp, setEditIp] = useState('');
    const [editError, setEditError] = useState(null);
    const [busyId, setBusyId] = useState(null);

    const configured = useMemo(() => domains.filter((d) => targetOf(d)), [domains]);
    const assignable = useMemo(() => domains.filter((d) => d.id && !targetOf(d)), [domains]);

    const resetAdd = () => { setAdding(false); setNewDomainId(''); setNewIp(''); setAddError(null); };

    const handleAdd = async () => {
        if (!newDomainId) { setAddError('Select a domain.'); return; }
        const value = newIp.trim();
        const check = validateTargetIp(value);
        if (!check.valid) { setAddError(check.message); return; }
        setSubmitting(true);
        setAddError(null);
        try {
            const res = await dispatch(addNetworkTarget({
                companyId, domainId: newDomainId, payload: { ip_address: value },
            }));
            if (addNetworkTarget.fulfilled.match(res)) resetAdd();
            else setAddError(res.payload?.error || 'Could not save target IP.');
        } finally { setSubmitting(false); }
    };

    const startEdit = (t) => { setEditingId(t.id); setEditIp(t.ip_address); setEditError(null); };
    const cancelEdit = () => { setEditingId(null); setEditIp(''); setEditError(null); };

    const saveEdit = async (domain, t) => {
        const value = editIp.trim();
        const check = validateTargetIp(value);
        if (!check.valid) { setEditError(check.message); return; }
        setBusyId(t.id);
        try {
            const res = await dispatch(updateNetworkTarget({
                companyId, domainId: domain.id, targetId: t.id, payload: { ip_address: value },
            }));
            if (updateNetworkTarget.fulfilled.match(res)) cancelEdit();
            else setEditError(res.payload?.error || 'Could not update IP.');
        } finally { setBusyId(null); }
    };

    const handleDelete = async (domain, t) => {
        setBusyId(t.id);
        try {
            await dispatch(removeNetworkTarget({ companyId, domainId: domain.id, targetId: t.id }));
        } finally { setBusyId(null); }
    };

    return (
        <div className="mt-6 bg-white border border-slate-200 rounded-lg">
            <div className="p-4 border-b border-slate-100 flex items-start gap-2">
                <Server size={16} className="text-slate-500 mt-0.5" />
                <div>
                    <h3 className="text-sm font-semibold text-slate-800">Network Security target IPs</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Optional, one per domain. Used only by the Network Security module — when set, the scan
                        targets this IP instead of DNS-resolving the domain.
                    </p>
                </div>
            </div>

            <div className="px-4 pt-3">
                <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-slate-50 mb-3">
                    <Info size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-500">
                        Configuration only — saving does not start an assessment or mark the domain as scanned.
                    </p>
                </div>
            </div>

            <div className="px-4 pb-4 space-y-2">
                {configured.length === 0 && !adding && (
                    <p className="text-xs text-slate-500 py-1">
                        No target IPs configured. All domains resolve via DNS during Network Security scans.
                    </p>
                )}

                {configured.map((domain) => {
                    const t = targetOf(domain);
                    return (
                        <div key={domain.id} className="flex items-center gap-3 p-2.5 rounded-md border border-slate-200 bg-slate-50">
                            <span className="text-sm text-slate-700 truncate min-w-0 flex-1">{domain.domain}</span>

                            {editingId === t.id ? (
                                <div className="flex-1 flex flex-col gap-1">
                                    <input autoFocus value={editIp} onChange={(e) => setEditIp(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(domain, t); if (e.key === 'Escape') cancelEdit(); }}
                                        className="nt-input font-mono" />
                                    {editError && <span className="text-xs text-red-600">{editError}</span>}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 flex-1">
                                    <span className="font-mono text-sm text-slate-800">{t.ip_address}</span>
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-white text-slate-500 rounded">IPv{t.ip_version}</span>
                                </div>
                            )}

                            <div className="flex items-center gap-1 flex-shrink-0">
                                {busyId === t.id ? (
                                    <Loader2 size={15} className="text-slate-400 animate-spin" />
                                ) : editingId === t.id ? (
                                    <>
                                        <button onClick={() => saveEdit(domain, t)} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600" aria-label="Save"><Save size={15} /></button>
                                        <button onClick={cancelEdit} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" aria-label="Cancel"><X size={15} /></button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => startEdit(t)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" aria-label={`Edit target IP for ${domain.domain}`}><Pencil size={15} /></button>
                                        <button onClick={() => handleDelete(domain, t)} className="p-1.5 rounded hover:bg-red-50 text-red-600" aria-label={`Remove target IP for ${domain.domain}`}><Trash2 size={15} /></button>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}

                {adding ? (
                    <div className="flex flex-col gap-2 p-3 rounded-md border border-slate-300 bg-white">
                        <div className="flex items-center gap-2">
                            <select autoFocus value={newDomainId} onChange={(e) => setNewDomainId(e.target.value)}
                                className="nt-input" aria-label="Select a domain">
                                <option value="">Select a domain…</option>
                                {assignable.map((d) => <option key={d.id} value={d.id}>{d.domain}</option>)}
                            </select>
                            <input value={newIp} onChange={(e) => setNewIp(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') resetAdd(); }}
                                placeholder="203.0.113.10 or 2001:db8::1" className="nt-input font-mono" aria-label="Target IP address" />
                            <button type="button" onClick={handleAdd} disabled={submitting}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50 text-white rounded-md whitespace-nowrap">
                                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                            </button>
                            <button type="button" onClick={resetAdd} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" aria-label="Cancel"><X size={15} /></button>
                        </div>
                        {addError && <span className="text-xs text-red-600">{addError}</span>}
                    </div>
                ) : (
                    <button type="button" onClick={() => setAdding(true)} disabled={assignable.length === 0}
                        title={assignable.length === 0 ? 'Every domain already has a target IP' : undefined}
                        className="inline-flex items-center gap-1 mt-1 px-3 py-1.5 text-sm border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                        <Plus size={14} /> Add target IP
                    </button>
                )}

                {assignable.length === 0 && domains.length > 0 && !adding && (
                    <p className="text-xs text-slate-500">Every domain already has a target IP. Edit or remove one to reassign.</p>
                )}
            </div>

            <style>{`.nt-input{flex:1;min-width:0;padding:.5rem .75rem;font-size:.875rem;border:1px solid #cbd5e1;border-radius:.375rem}`}</style>
        </div>
    );
}
