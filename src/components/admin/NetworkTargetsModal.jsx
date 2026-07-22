import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Plus, Trash2, Save, X, Pencil, Star, Loader2, Server } from 'lucide-react';
import {
    addNetworkTarget,
    updateNetworkTarget,
    removeNetworkTarget,
} from '../../features/admin/adminDomainsSlice';
import { validateTargetIp, isDuplicateIp } from '../../utils/ipValidation';

/**
 * Admin management of a domain's Network Security target IPs.
 *
 * Admin acts on behalf of the tenant. These IPs are used ONLY by the Network
 * Security module — when configured, the scan targets them instead of
 * DNS-resolving the domain (fixes CDN/WAF edge IPs). The PRIMARY target
 * (marked "Scanned") is the IP actively submitted to the scanner.
 *
 * `targets` comes from the domain's embedded `network_targets` (kept fresh by
 * the slice, which resyncs after every mutation). Self-contained modal chrome
 * matching the page's existing modal style.
 */
export default function NetworkTargetsModal({ open, onClose, companyId, domain }) {
    const dispatch = useDispatch();
    const domainId = domain?.id;
    const targets = domain?.network_targets || [];

    const [newIp, setNewIp] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [addError, setAddError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [editIp, setEditIp] = useState('');
    const [editLabel, setEditLabel] = useState('');
    const [editError, setEditError] = useState(null);

    const [busyId, setBusyId] = useState(null);

    if (!open) return null;

    const resetAdd = () => { setNewIp(''); setNewLabel(''); setAddError(null); };

    const handleAdd = async () => {
        const value = newIp.trim();
        const check = validateTargetIp(value);
        if (!check.valid) { setAddError(check.message); return; }
        if (isDuplicateIp(value, targets)) { setAddError('This IP is already configured for this domain.'); return; }
        setSubmitting(true);
        setAddError(null);
        try {
            await dispatch(addNetworkTarget({ companyId, domainId, payload: { ip_address: value, label: newLabel.trim() || null } }));
            resetAdd();
        } finally {
            setSubmitting(false);
        }
    };

    const startEdit = (t) => { setEditingId(t.id); setEditIp(t.ip_address); setEditLabel(t.label || ''); setEditError(null); };
    const cancelEdit = () => { setEditingId(null); setEditIp(''); setEditLabel(''); setEditError(null); };

    const saveEdit = async (t) => {
        const value = editIp.trim();
        const check = validateTargetIp(value);
        if (!check.valid) { setEditError(check.message); return; }
        if (isDuplicateIp(value, targets, t.id)) { setEditError('This IP is already configured for this domain.'); return; }
        setBusyId(t.id);
        try {
            await dispatch(updateNetworkTarget({ companyId, domainId, targetId: t.id, payload: { ip_address: value, label: editLabel.trim() || null } }));
            cancelEdit();
        } finally {
            setBusyId(null);
        }
    };

    const makePrimary = async (t) => {
        if (t.is_primary) return;
        setBusyId(t.id);
        try {
            await dispatch(updateNetworkTarget({ companyId, domainId, targetId: t.id, payload: { is_primary: true } }));
        } finally { setBusyId(null); }
    };

    const toggleActive = async (t) => {
        setBusyId(t.id);
        try {
            await dispatch(updateNetworkTarget({ companyId, domainId, targetId: t.id, payload: { is_active: !t.is_active } }));
        } finally { setBusyId(null); }
    };

    const handleDelete = async (t) => {
        setBusyId(t.id);
        try {
            await dispatch(removeNetworkTarget({ companyId, domainId, targetId: t.id }));
        } finally { setBusyId(null); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-xl mx-4 bg-white rounded-lg shadow-xl">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Server size={18} className="text-guardian-navy" />
                        <h3 className="text-base font-semibold">Network Security Target IPs</h3>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>

                <div className="p-5">
                    <p className="text-xs text-slate-500 mb-3">
                        <span className="font-mono text-slate-700">{domain?.domain}</span> — used by the Network Security
                        module only. When one or more active IPs are set, scans target them instead of DNS-resolving the
                        domain (fixes CDN/WAF edge IPs). The <span className="font-medium">Scanned</span> IP is the active target.
                    </p>

                    <div className="space-y-2 mb-4">
                        {targets.length === 0 && (
                            <p className="text-xs text-slate-500 py-2">No target IPs configured. Scans resolve this domain via DNS.</p>
                        )}
                        {targets.map((t) => (
                            <div key={t.id} className={`flex items-center gap-2 p-2.5 rounded-md border ${t.is_active ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white opacity-60'}`}>
                                {editingId === t.id ? (
                                    <div className="flex-1 flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <input autoFocus value={editIp} onChange={(e) => setEditIp(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(t); if (e.key === 'Escape') cancelEdit(); }}
                                                placeholder="203.0.113.10" className="form-input font-mono" />
                                            <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
                                                placeholder="Label (optional)" className="form-input" />
                                        </div>
                                        {editError && <span className="text-xs text-red-600">{editError}</span>}
                                    </div>
                                ) : (
                                    <>
                                        <span className="font-mono text-sm text-slate-800">{t.ip_address}</span>
                                        <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">IPv{t.ip_version}</span>
                                        {t.label && <span className="text-xs text-slate-500 truncate">{t.label}</span>}
                                        {t.is_primary && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
                                                <Star size={11} /> Scanned
                                            </span>
                                        )}
                                        {!t.is_active && <span className="text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full">Inactive</span>}
                                    </>
                                )}

                                <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                                    {busyId === t.id ? (
                                        <Loader2 size={16} className="text-slate-400 animate-spin" />
                                    ) : editingId === t.id ? (
                                        <>
                                            <button onClick={() => saveEdit(t)} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600" aria-label="Save"><Save size={15} /></button>
                                            <button onClick={cancelEdit} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" aria-label="Cancel"><X size={15} /></button>
                                        </>
                                    ) : (
                                        <>
                                            {!t.is_primary && t.is_active && (
                                                <button onClick={() => makePrimary(t)} className="p-1.5 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600" title="Make scanned target"><Star size={15} /></button>
                                            )}
                                            <button onClick={() => toggleActive(t)} className="px-2 py-1 text-[11px] rounded text-slate-500 hover:bg-slate-100" title={t.is_active ? 'Deactivate' : 'Activate'}>
                                                {t.is_active ? 'Disable' : 'Enable'}
                                            </button>
                                            <button onClick={() => startEdit(t)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" aria-label="Edit"><Pencil size={15} /></button>
                                            <button onClick={() => handleDelete(t)} className="p-1.5 rounded hover:bg-red-50 text-red-600" aria-label="Remove"><Trash2 size={15} /></button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Add target IP</label>
                        <div className="flex items-center gap-2">
                            <input value={newIp} onChange={(e) => setNewIp(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                                placeholder="203.0.113.10 or 2001:db8::1" className="form-input font-mono" />
                            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                                placeholder="Label (optional)" className="form-input" />
                            <button type="button" onClick={handleAdd} disabled={submitting || !newIp.trim()}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50 text-white rounded-md whitespace-nowrap">
                                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
                            </button>
                        </div>
                        {addError && <span className="text-xs text-red-600 mt-1 block">{addError}</span>}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100">
                    <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-700 hover:text-slate-900">Close</button>
                </div>

                <style>{`.form-input{width:100%;padding:.5rem .75rem;font-size:.875rem;border:1px solid #cbd5e1;border-radius:.375rem}`}</style>
            </div>
        </div>
    );
}
