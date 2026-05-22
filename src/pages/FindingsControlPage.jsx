import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    ShieldHalf, Loader2, Eye, EyeOff, Send, Ban, AlertTriangle,
    RotateCcw, X, GitBranch, FileText, CheckCircle2,
} from 'lucide-react';
import {
    fetchFindings, fetchFinding, fetchFindingTrace,
    updateFindingGovernance, findingAction, bulkFindingAction,
    selectFindings, selectFindingsMeta, selectFindingsLoading,
    selectFinding, selectFindingTrace, selectFindingActing, selectLastBulk,
} from '../features/admin/adminFindingsSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';

const SEVERITY = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' };
const SEV_CLASS = {
    1: 'bg-slate-100 text-slate-700',
    2: 'bg-amber-100 text-amber-800',
    3: 'bg-orange-100 text-orange-800',
    4: 'bg-red-100 text-red-800',
};
const SUPPRESSION_OPTIONS = [
    { value: 'false_positive', label: 'False positive' },
    { value: 'accepted_risk', label: 'Accepted risk' },
    { value: 'duplicate', label: 'Duplicate' },
    { value: 'out_of_scope', label: 'Out of scope' },
    { value: 'temporary_exception', label: 'Temporary exception' },
    { value: 'customer_request', label: 'Customer request' },
    { value: 'stale_data', label: 'Stale data' },
];

export default function FindingsControlPage() {
    const dispatch = useDispatch();
    const list    = useSelector(selectFindings);
    const meta    = useSelector(selectFindingsMeta);
    const loading = useSelector(selectFindingsLoading);
    const lastBulk = useSelector(selectLastBulk);

    const [filters, setFilters] = useState({});
    const [page, setPage]       = useState(1);
    const [selected, setSelected] = useState([]);
    const [openId, setOpenId]   = useState(null);

    const reload = useCallback(() => {
        dispatch(fetchFindings({ ...filters, page, per_page: 50 }));
    }, [dispatch, filters, page]);

    useEffect(() => { reload(); }, [reload]);

    const toggleSelect = (id) =>
        setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

    const runBulk = async (action, extra = {}) => {
        await dispatch(bulkFindingAction({ ids: selected, action, ...extra }));
        setSelected([]);
        reload();
    };

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                    <ShieldHalf size={22} /> Findings Control
                </h1>
                <p className="text-sm text-slate-600 max-w-3xl">
                    The control plane between normalised findings and what customers see. Decide visibility,
                    score/compliance impact, publish state, and lifecycle (suppress, false-positive, accept-risk)
                    for every finding. Critical-severity suppressions are routed to the approval queue. Every
                    change is audited and reversible.
                </p>
            </header>

            <AdminFilterBar
                filters={[
                    { key: 'search',     type: 'text',   label: 'Search', placeholder: 'Title, asset…' },
                    { key: 'company_id', type: 'text',   label: 'Company', placeholder: 'cmp_…' },
                    { key: 'severity',   type: 'select', label: 'Severity', options: [
                        { value: '4', label: 'Critical' }, { value: '3', label: 'High' },
                        { value: '2', label: 'Medium' }, { value: '1', label: 'Low' } ] },
                    { key: 'status',     type: 'select', label: 'Status', options: [
                        { value: 'open', label: 'Open' }, { value: 'suppressed', label: 'Suppressed' },
                        { value: 'false_positive', label: 'False positive' }, { value: 'accepted_risk', label: 'Accepted risk' } ] },
                    { key: 'visibility', type: 'select', label: 'Visibility', options: [
                        { value: 'visible', label: 'Visible' }, { value: 'hidden', label: 'Hidden' } ] },
                    { key: 'published',  type: 'select', label: 'Published', options: [
                        { value: 'published', label: 'Published' }, { value: 'unpublished', label: 'Unpublished' } ] },
                    { key: 'source_api', type: 'text',   label: 'Source API', placeholder: 'ssl_scanner…' },
                ]}
                value={filters}
                onChange={(v) => { setFilters(v); setPage(1); }}
                onClear={() => { setFilters({}); setPage(1); }}
            />

            {selected.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-guardian-navy/5 border border-guardian-navy/15 rounded-lg text-sm">
                    <span className="font-medium text-guardian-navy">{selected.length} selected</span>
                    <button onClick={() => runBulk('publish')}   className="px-2 py-1 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-700">Publish</button>
                    <button onClick={() => runBulk('unpublish')} className="px-2 py-1 rounded bg-slate-600 text-white text-xs hover:bg-slate-700">Unpublish</button>
                    <button onClick={() => runBulk('suppress', { suppression_type: 'accepted_risk', reason: 'Bulk suppression' })}
                            className="px-2 py-1 rounded bg-amber-600 text-white text-xs hover:bg-amber-700">Suppress</button>
                    <button onClick={() => setSelected([])} className="ml-auto text-xs text-slate-500 hover:text-slate-800">Clear</button>
                </div>
            )}

            {lastBulk?.queued_approval?.length > 0 && (
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    {lastBulk.queued_approval.length} critical finding(s) were routed to the approval queue instead of being changed directly.
                </div>
            )}

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                        <tr>
                            <th className="w-8 px-3 py-2"></th>
                            <th className="text-left px-3 py-2">Finding</th>
                            <th className="text-left px-3 py-2">Module</th>
                            <th className="text-left px-3 py-2">Severity</th>
                            <th className="text-left px-3 py-2">Status</th>
                            <th className="text-left px-3 py-2">Visibility</th>
                            <th className="text-left px-3 py-2">Published</th>
                            <th className="text-left px-3 py-2">Score</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && (
                            <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                                <Loader2 className="inline animate-spin mr-2" size={16} /> Loading findings…
                            </td></tr>
                        )}
                        {!loading && list.length === 0 && (
                            <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">No findings match these filters.</td></tr>
                        )}
                        {!loading && list.map((f) => (
                            <tr key={f.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setOpenId(f.id); dispatch(fetchFinding(f.id)); }}>
                                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                    <input type="checkbox" checked={selected.includes(f.id)} onChange={() => toggleSelect(f.id)} />
                                </td>
                                <td className="px-3 py-2">
                                    <div className="font-medium text-slate-800 truncate max-w-xs">{f.title}</div>
                                    <div className="text-xs text-slate-400">{f.asset || f.id}</div>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{f.module}</td>
                                <td className="px-3 py-2">
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${SEV_CLASS[f.severity] || 'bg-slate-100'}`}>
                                        {SEVERITY[f.severity] || f.severity}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{f.governance_status}</td>
                                <td className="px-3 py-2">
                                    {f.visible_to_customer
                                        ? <span className="inline-flex items-center gap-1 text-emerald-700 text-xs"><Eye size={12} /> Visible</span>
                                        : <span className="inline-flex items-center gap-1 text-slate-400 text-xs"><EyeOff size={12} /> Hidden</span>}
                                </td>
                                <td className="px-3 py-2">
                                    {f.published
                                        ? <span className="inline-flex items-center gap-1 text-emerald-700 text-xs"><CheckCircle2 size={12} /> Live</span>
                                        : <span className="text-slate-400 text-xs">Draft</span>}
                                </td>
                                <td className="px-3 py-2 text-xs">
                                    {f.affects_score ? <span className="text-slate-700">Counts</span> : <span className="text-slate-400">Excluded</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {meta && meta.last_page > 1 && (
                <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>Page {meta.current_page} of {meta.last_page} · {meta.total} findings</span>
                    <div className="flex gap-2">
                        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                            className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">Prev</button>
                        <button disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}
                            className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}

            {openId && (
                <FindingDrawer id={openId} onClose={() => setOpenId(null)} onChanged={reload} />
            )}
        </div>
    );
}

// ── Detail drawer ───────────────────────────────────────────────────────

function FindingDrawer({ id, onClose, onChanged }) {
    const dispatch = useDispatch();
    const detail = useSelector((s) => selectFinding(s, id));
    const trace  = useSelector((s) => selectFindingTrace(s, id));
    const acting = useSelector(selectFindingActing);
    const [tab, setTab]   = useState('governance');
    const [modal, setModal] = useState(null); // { action, title, requireReason, ... }

    const gov = detail?.governance;
    const finding = detail?.finding;

    const toggle = async (field, value) => {
        await dispatch(updateFindingGovernance({ id, body: { [field]: value } }));
        dispatch(fetchFinding(id));
        onChanged();
    };

    const act = async (action, body = {}) => {
        const r = await dispatch(findingAction({ id, action, body }));
        const queued = r?.payload?.status === 202;
        dispatch(fetchFinding(id));
        onChanged();
        return queued;
    };

    return (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
            <div className="w-full max-w-xl h-full bg-white shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between">
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900 truncate">{finding?.title || id}</h2>
                        <p className="text-xs text-slate-400">{finding?.module} · {id}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
                </div>

                <div className="flex border-b border-slate-100 text-sm">
                    {['governance', 'customer text', 'trace'].map((t) => (
                        <button key={t}
                            onClick={() => { setTab(t); if (t === 'trace') dispatch(fetchFindingTrace(id)); }}
                            className={`px-4 py-2 capitalize ${tab === t ? 'border-b-2 border-guardian-navy text-guardian-navy font-medium' : 'text-slate-500'}`}>
                            {t}
                        </button>
                    ))}
                </div>

                {!detail && <div className="p-8 text-center text-slate-400"><Loader2 className="inline animate-spin" size={18} /></div>}

                {detail && tab === 'governance' && (
                    <div className="p-5 space-y-5">
                        <section className="space-y-2">
                            <h3 className="text-xs uppercase tracking-wide text-slate-400">Visibility</h3>
                            <Toggle label="Visible to customer"   value={gov?.visible_to_customer ?? true}          onChange={(v) => toggle('visible_to_customer', v)} />
                            <Toggle label="Show in dashboard"      value={gov?.visible_in_dashboard ?? true}         onChange={(v) => toggle('visible_in_dashboard', v)} />
                            <Toggle label="Show in report"         value={gov?.visible_in_report ?? true}            onChange={(v) => toggle('visible_in_report', v)} />
                            <Toggle label="Show in exec summary"   value={gov?.visible_in_executive_summary ?? true} onChange={(v) => toggle('visible_in_executive_summary', v)} />
                        </section>
                        <section className="space-y-2">
                            <h3 className="text-xs uppercase tracking-wide text-slate-400">Downstream impact</h3>
                            <Toggle label="Affects risk score"     value={gov?.affects_score ?? true}      onChange={(v) => toggle('affects_score', v)} />
                            <Toggle label="Affects compliance"     value={gov?.affects_compliance ?? true} onChange={(v) => toggle('affects_compliance', v)} />
                            <Toggle label="Eligible for ticketing" value={gov?.affects_ticketing ?? true}  onChange={(v) => toggle('affects_ticketing', v)} />
                            <Toggle label="Eligible for takedown"  value={gov?.affects_takedown ?? true}   onChange={(v) => toggle('affects_takedown', v)} />
                        </section>

                        <section className="space-y-2">
                            <h3 className="text-xs uppercase tracking-wide text-slate-400">Actions</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <ActionBtn icon={Send}  label={gov?.published_at ? 'Republish' : 'Publish'} color="emerald" onClick={() => act('publish')} disabled={acting} />
                                <ActionBtn icon={EyeOff} label="Unpublish" color="slate"   onClick={() => act('unpublish')} disabled={acting} />
                                <ActionBtn icon={Ban}    label="Suppress" color="amber"
                                    onClick={() => setModal({ action: 'suppress', title: 'Suppress finding', requireReason: true, withType: true })} disabled={acting} />
                                <ActionBtn icon={AlertTriangle} label="False positive" color="amber"
                                    onClick={() => setModal({ action: 'false-positive', title: 'Mark as false positive', requireReason: true })} disabled={acting} />
                                <ActionBtn icon={AlertTriangle} label="Accept risk" color="amber"
                                    onClick={() => setModal({ action: 'accept-risk', title: 'Accept risk', requireReason: true })} disabled={acting} />
                                <ActionBtn icon={RotateCcw} label="Restore" color="slate" onClick={() => act('restore')} disabled={acting} />
                            </div>
                            {finding?.severity >= 4 && (
                                <p className="text-xs text-amber-700 flex items-center gap-1">
                                    <AlertTriangle size={12} /> Critical finding — suppress / false-positive will be queued for approval.
                                </p>
                            )}
                        </section>

                        <ScoreImpact data={detail.score_impact} />
                    </div>
                )}

                {detail && tab === 'customer text' && (
                    <CustomerText id={id} gov={gov} onSaved={() => { dispatch(fetchFinding(id)); onChanged(); }} />
                )}

                {detail && tab === 'trace' && <TracePanel trace={trace} />}
            </div>

            {modal && (
                <SuppressModal
                    modal={modal}
                    onCancel={() => setModal(null)}
                    onConfirm={async (payload) => {
                        await act(modal.action, payload);
                        setModal(null);
                    }}
                />
            )}
        </div>
    );
}

function SuppressModal({ modal, onCancel, onConfirm }) {
    const [type, setType] = useState('false_positive');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const ok = reason.trim().length > 0;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onCancel}>
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-100">
                    <h3 className="text-base font-semibold text-slate-900">{modal.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                        {modal.withType ? 'Choose a suppression type and provide a reason.' : 'Provide a reason.'} This is recorded permanently in the audit log.
                    </p>
                </div>
                <div className="p-5 space-y-3">
                    {modal.withType && (
                        <select value={type} onChange={(e) => setType(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm">
                            {SUPPRESSION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    )}
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                        placeholder="Reason (required)"
                        className="w-full text-sm p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20" />
                </div>
                <div className="px-5 pb-5 flex justify-end gap-2">
                    <button onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-700 hover:text-slate-900">Cancel</button>
                    <button disabled={!ok || busy}
                        onClick={async () => { setBusy(true); try { await onConfirm(modal.withType ? { suppression_type: type, reason: reason.trim() } : { reason: reason.trim() }); } finally { setBusy(false); } }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-md bg-amber-600 hover:bg-amber-700 disabled:opacity-50">
                        {busy && <Loader2 size={14} className="animate-spin" />} Apply
                    </button>
                </div>
            </div>
        </div>
    );
}

function CustomerText({ id, gov, onSaved }) {
    const dispatch = useDispatch();
    const [title, setTitle] = useState(gov?.customer_title || '');
    const [desc, setDesc]   = useState(gov?.customer_description || '');
    const [rem, setRem]     = useState(gov?.customer_remediation || '');
    const save = async () => {
        await dispatch(findingAction({ id, action: 'customer-text', body: { customer_title: title, customer_description: desc, customer_remediation: rem } }));
        onSaved();
    };
    return (
        <div className="p-5 space-y-3">
            <p className="text-xs text-slate-500">Override the customer-facing copy. Internal fields are kept separate and never shown to customers.</p>
            <Field label="Customer title"        value={title} onChange={setTitle} />
            <Field label="Customer description"  value={desc}  onChange={setDesc} textarea />
            <Field label="Customer remediation"  value={rem}   onChange={setRem}  textarea />
            <button onClick={save} className="px-3 py-1.5 rounded bg-guardian-navy text-white text-sm hover:bg-guardian-navy-800">Save customer text</button>
        </div>
    );
}

function TracePanel({ trace }) {
    if (!trace) return <div className="p-8 text-center text-slate-400"><Loader2 className="inline animate-spin" size={18} /></div>;
    const p = trace.pipeline || {};
    const Stage = ({ label, children }) => (
        <div className="relative pl-5 pb-4 border-l border-slate-200">
            <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-guardian-navy" />
            <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
            <div className="text-sm text-slate-700 mt-0.5">{children}</div>
        </div>
    );
    return (
        <div className="p-5">
            <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-3 flex items-center gap-1"><GitBranch size={12} /> Lineage</h3>
            <Stage label="Raw API">{p.raw_api?.source_api || '—'}{p.raw_api?.raw_payload_id ? ` · ${p.raw_api.raw_payload_id}` : ''}</Stage>
            <Stage label="Normalised finding">{p.normalised_finding?.module} · severity {p.normalised_finding?.severity}</Stage>
            <Stage label="Governance">{p.governance?.status || 'ungoverned'}{p.governance?.suppression_type ? ` · ${p.governance.suppression_type}` : ''}</Stage>
            <Stage label="Published finding">{p.published_finding?.published ? 'Published' : 'Draft'} · {p.published_finding?.visible_to_customer ? 'visible' : 'hidden'}</Stage>
            <Stage label="Downstream">
                Score: {p.downstream?.affects_score ? 'yes' : 'no'} · Compliance: {p.downstream?.affects_compliance ? 'yes' : 'no'}
                {p.downstream?.ticket_id ? ` · ticket ${p.downstream.ticket_id}` : ''}
                {p.downstream?.takedown_case_id ? ` · takedown ${p.downstream.takedown_case_id}` : ''}
            </Stage>
            <h3 className="text-xs uppercase tracking-wide text-slate-400 mt-4 mb-2 flex items-center gap-1"><FileText size={12} /> Audit timeline</h3>
            <div className="space-y-1">
                {(trace.audit_timeline || []).map((a) => (
                    <div key={a.id} className="text-xs text-slate-600 flex justify-between">
                        <span>{a.action}{a.rolled_back_at ? ' (rolled back)' : ''}</span>
                        <span className="text-slate-400">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</span>
                    </div>
                ))}
                {(!trace.audit_timeline || trace.audit_timeline.length === 0) && <div className="text-xs text-slate-400">No audit entries yet.</div>}
            </div>
        </div>
    );
}

function ScoreImpact({ data }) {
    if (!data) return null;
    return (
        <section className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <h3 className="text-xs uppercase tracking-wide text-slate-400">Score impact</h3>
            <div>Severity: {data.severity_original} → {data.severity_current}</div>
            <div>Counts toward score: <span className={data.counts_toward_score ? 'text-emerald-700' : 'text-slate-400'}>{data.counts_toward_score ? 'yes' : 'no'}</span></div>
        </section>
    );
}

function Toggle({ label, value, onChange }) {
    return (
        <label className="flex items-center justify-between text-sm text-slate-700 cursor-pointer">
            <span>{label}</span>
            <button type="button" onClick={() => onChange(!value)}
                className={`w-9 h-5 rounded-full transition-colors relative ${value ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
        </label>
    );
}

function ActionBtn({ icon: Icon, label, color, onClick, disabled }) {
    const colors = {
        emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        amber: 'bg-amber-600 hover:bg-amber-700 text-white',
        slate: 'bg-slate-200 hover:bg-slate-300 text-slate-800',
    };
    return (
        <button onClick={onClick} disabled={disabled}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50 ${colors[color]}`}>
            <Icon size={13} /> {label}
        </button>
    );
}

function Field({ label, value, onChange, textarea }) {
    return (
        <label className="block">
            <span className="text-xs text-slate-500">{label}</span>
            {textarea
                ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
                    className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                : <input value={value} onChange={(e) => onChange(e.target.value)}
                    className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />}
        </label>
    );
}
