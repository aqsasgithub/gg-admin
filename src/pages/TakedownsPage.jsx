import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Sword, Loader2, Send, ArrowUpCircle, CheckCircle2, Lock, Plus } from 'lucide-react';
import {
    fetchTakedownControl, takedownCaseAction, createTakedownCase,
    selectTakedownControl, selectTakedownControlMeta, selectTakedownControlLoading, selectTakedownControlActing,
} from '../features/admin/adminTakedownControlSlice';
import { selectAdminCapabilities } from '../features/auth/authSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';

const SEV = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' };

export default function TakedownsPage() {
    const dispatch = useDispatch();
    const list    = useSelector(selectTakedownControl);
    const meta    = useSelector(selectTakedownControlMeta);
    const loading = useSelector(selectTakedownControlLoading);
    const acting  = useSelector(selectTakedownControlActing);
    const caps    = useSelector(selectAdminCapabilities);
    const can = (c) => caps.includes('*') || caps.includes(c);
    const canWrite = can('takedowns.write');

    const [filters, setFilters] = useState({});
    const [reasonFor, setReasonFor] = useState(null); // { id, action }
    const [submitFor, setSubmitFor] = useState(null); // case id for the submit modal
    const [showCreate, setShowCreate] = useState(false);

    const reload = () => dispatch(fetchTakedownControl(filters));
    useEffect(() => { reload(); }, [dispatch, JSON.stringify(filters)]);

    const act = async (id, action, body = {}) => { await dispatch(takedownCaseAction({ id, action, body })); reload(); };

    return (
        <div className="p-6 space-y-4">
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2"><Sword size={22} /> Takedowns — Control</h1>
                    <p className="text-sm text-slate-600 max-w-3xl">Open cases with target URLs, submit to providers, escalate, resolve and force-close. Submissions run through the real takedown pipeline; force-close is routed to the approval queue.</p>
                </div>
                {canWrite && (
                    <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-guardian-navy text-white text-sm hover:bg-guardian-navy-800"><Plus size={14} /> New case</button>
                )}
            </header>

            <AdminFilterBar
                filters={[
                    { key: 'status', type: 'text', label: 'Status', placeholder: 'open / submitted…' },
                    { key: 'abuse_kind', type: 'text', label: 'Abuse kind' },
                ]}
                value={filters} onChange={setFilters} onClear={() => setFilters({})}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                        <tr>
                            <th className="text-left px-3 py-2">Case</th>
                            <th className="text-left px-3 py-2">Brand</th>
                            <th className="text-left px-3 py-2">Severity</th>
                            <th className="text-left px-3 py-2">Status</th>
                            <th className="text-right px-3 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400"><Loader2 className="inline animate-spin mr-2" size={16} /> Loading…</td></tr>}
                        {!loading && list.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No takedown cases.</td></tr>}
                        {!loading && list.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2"><div className="font-medium text-slate-800">{c.id}</div><div className="text-xs text-slate-400">{c.abuse_kind}</div></td>
                                <td className="px-3 py-2 text-slate-600">{c.protected_brand || '—'}</td>
                                <td className="px-3 py-2 text-slate-600">{SEV[c.severity] || c.severity || '—'}</td>
                                <td className="px-3 py-2 text-slate-600">{c.status}</td>
                                <td className="px-3 py-2 text-right">
                                    {canWrite ? (
                                        <div className="inline-flex gap-1">
                                            <ActBtn icon={Send} label="Submit" onClick={() => setSubmitFor(c.id)} disabled={acting} />
                                            <ActBtn icon={ArrowUpCircle} label="Escalate" amber onClick={() => setReasonFor({ id: c.id, action: 'escalate' })} disabled={acting} />
                                            <ActBtn icon={CheckCircle2} label="Resolve" onClick={() => act(c.id, 'resolve')} disabled={acting} />
                                            <ActBtn icon={Lock} label="Force-close" red onClick={() => setReasonFor({ id: c.id, action: 'force-close' })} disabled={acting} />
                                        </div>
                                    ) : <span className="text-xs text-slate-400">View only</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {meta && <div className="text-xs text-slate-500">{meta.total} cases</div>}

            {reasonFor && (
                <ReasonModal
                    title={reasonFor.action === 'force-close' ? 'Force-close case (needs approval)' : 'Escalate case'}
                    onCancel={() => setReasonFor(null)}
                    onConfirm={async (reason) => { await act(reasonFor.id, reasonFor.action, { reason }); setReasonFor(null); }}
                />
            )}

            {submitFor && (
                <SubmitModal
                    onCancel={() => setSubmitFor(null)}
                    onConfirm={async (body) => { await act(submitFor, 'submit', body); setSubmitFor(null); }}
                />
            )}

            {showCreate && canWrite && (
                <CreateCaseModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); reload(); }} />
            )}
        </div>
    );
}

function SubmitModal({ onCancel, onConfirm }) {
    const [providerId, setProviderId] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [busy, setBusy] = useState(false);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-semibold text-slate-900">Submit takedown</h3>
                <label className="block text-sm">Provider override (optional)
                    <input value={providerId} onChange={(e) => setProviderId(e.target.value)} placeholder="leave blank to auto-route (godaddy, urlhaus, cloudflare…)" className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                </label>
                <label className="block text-sm">Complaint template (optional)
                    <input value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="template id" className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                </label>
                <p className="text-xs text-slate-400">Blank provider → the router picks providers per target. Submissions build evidence + complaint and run the real pipeline.</p>
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-700">Cancel</button>
                    <button disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm({ provider_id: providerId || undefined, template_id: templateId || undefined }); } finally { setBusy(false); } }}
                        className="px-3 py-1.5 text-sm text-white rounded bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50">Submit</button>
                </div>
            </div>
        </div>
    );
}

function CreateCaseModal({ onClose, onCreated }) {
    const dispatch = useDispatch();
    const [form, setForm] = useState({ company_id: '', protected_brand: '', abuse_kind: 'phishing', notice_kind: 'dmca', severity: 3, urls: '', evidence: '' });
    const [busy, setBusy] = useState(false);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
    const submit = async () => {
        setBusy(true);
        try {
            const urls = form.urls.split('\n').map((u) => u.trim()).filter(Boolean);
            await dispatch(createTakedownCase({
                company_id: form.company_id,
                protected_brand: form.protected_brand || undefined,
                abuse_kind: form.abuse_kind,
                notice_kind: form.notice_kind,
                severity: Number(form.severity) || undefined,
                urls,
                evidence_note: form.evidence || undefined,
            }));
            onCreated();
        } finally { setBusy(false); }
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-lg bg-white rounded-lg shadow-xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-semibold text-slate-900">New takedown case</h3>
                <label className="block text-sm">Company ID *<input value={form.company_id} onChange={set('company_id')} placeholder="cmp_…" className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" /></label>
                <label className="block text-sm">Protected brand<input value={form.protected_brand} onChange={set('protected_brand')} className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" /></label>
                <div className="grid grid-cols-3 gap-2">
                    <label className="block text-sm">Abuse kind
                        <select value={form.abuse_kind} onChange={set('abuse_kind')} className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm">
                            {['phishing','malware','spoofing','counterfeit','impersonation'].map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm">Notice kind
                        <select value={form.notice_kind} onChange={set('notice_kind')} className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm">
                            {['dmca','abuse','trademark','phishing_report'].map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm">Severity
                        <select value={form.severity} onChange={set('severity')} className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm">
                            {[1,2,3,4].map((n) => <option key={n} value={n}>{['Low','Medium','High','Critical'][n-1]}</option>)}
                        </select>
                    </label>
                </div>
                <label className="block text-sm">Target URLs (one per line) *
                    <textarea value={form.urls} onChange={set('urls')} rows={4} placeholder="https://phish.example.com/login&#10;https://evil.example.net" className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm font-mono" />
                </label>
                <label className="block text-sm">Evidence note (optional)
                    <textarea value={form.evidence} onChange={set('evidence')} rows={2} placeholder="context for the abuse report" className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                </label>
                <p className="text-xs text-slate-400">URLs become takedown targets via the orchestrator (evidence collection + provider routing). A case without URLs cannot be submitted.</p>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-700">Cancel</button>
                    <button disabled={!form.company_id || !form.urls.trim() || busy} onClick={submit}
                        className="px-3 py-1.5 text-sm text-white rounded bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50">Create case</button>
                </div>
            </div>
        </div>
    );
}

function ActBtn({ icon: Icon, label, onClick, disabled, amber, red }) {
    const cls = red ? 'bg-red-100 text-red-700 hover:bg-red-200' : amber ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200';
    return <button onClick={onClick} disabled={disabled} title={label} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${cls} disabled:opacity-50`}><Icon size={12} /> {label}</button>;
}

function ReasonModal({ title, onCancel, onConfirm }) {
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-semibold text-slate-900">{title}</h3>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason (required)" className="w-full text-sm p-2 border border-slate-300 rounded-md" />
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-700">Cancel</button>
                    <button disabled={!reason.trim() || busy} onClick={async () => { setBusy(true); try { await onConfirm(reason.trim()); } finally { setBusy(false); } }}
                        className="px-3 py-1.5 text-sm text-white rounded bg-amber-600 hover:bg-amber-700 disabled:opacity-50">Confirm</button>
                </div>
            </div>
        </div>
    );
}

// Re-exported pills used by CompanyTakedownsTab + TakedownDetailPage.
export function TakedownStatusPill({ status }) {
    const map = {
        open: 'bg-blue-100 text-blue-800', submitted: 'bg-indigo-100 text-indigo-800',
        escalated: 'bg-amber-100 text-amber-800', resolved: 'bg-emerald-100 text-emerald-800',
        closed: 'bg-slate-200 text-slate-700',
    };
    return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-slate-100 text-slate-700'}`}>{status || '—'}</span>;
}

export function SeverityPill({ severity }) {
    const map = { 1: 'bg-slate-100 text-slate-700', 2: 'bg-amber-100 text-amber-800', 3: 'bg-orange-100 text-orange-800', 4: 'bg-red-100 text-red-800' };
    return <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${map[severity] || 'bg-slate-100 text-slate-700'}`}>{SEV[severity] || severity || '—'}</span>;
}
