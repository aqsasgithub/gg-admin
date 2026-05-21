import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, Link } from 'react-router-dom';
import {
    AlertTriangle, ArrowLeft, User, MessageSquare, Loader2, Clock,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchAlert, transitionAlert, assignAlert, addAlertNote,
    selectAlert,
} from '../features/admin/adminAlertsSlice';
import { AlertStatusPill, AlertSeverityPill } from './AlertsPage';

const STATUSES = [
    'open', 'acknowledged', 'in_progress',
    'resolved', 'suppressed', 'false_positive', 'accepted_risk',
];

const RESOLVED_REASONS = [
    'remediated', 'false_positive', 'accepted_risk', 'suppressed', 'superseded',
];

export default function AlertDetailPage() {
    const { id } = useParams();
    const dispatch = useDispatch();
    const detail = useSelector((s) => selectAlert(s, id));

    const [action, setAction] = useState(null);  // 'transition' | 'assign' | 'note'

    useEffect(() => { dispatch(fetchAlert(id)); }, [dispatch, id]);

    if (!detail) {
        return (
            <div className="p-6 text-center text-slate-500">
                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
            </div>
        );
    }

    const a = detail.alert;

    return (
        <div className="p-6 space-y-4">
            <div>
                <Link to="/alerts" className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
                    <ArrowLeft size={14} /> Back to queue
                </Link>
            </div>

            <header className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                        <AlertTriangle size={20} /> {a.title}
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                        First seen {a.first_seen_at ? formatDistanceToNow(parseISO(a.first_seen_at), { addSuffix: true }) : '—'}
                        {' · '}
                        Seen {a.seen_count}× · {a.module}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <AlertSeverityPill severity={a.severity} />
                    <AlertStatusPill status={a.status} />
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                    <Card title="Alert">
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <KV label="Finding key" value={<code className="text-xs">{a.finding_key}</code>} />
                            <KV label="Affected asset" value={<code className="text-xs break-all">{a.affected_asset ?? '—'}</code>} />
                            <KV label="Final score" value={a.final_score} />
                            <KV label="Matrix priority" value={a.matrix_priority ?? '—'} />
                            <KV label="Confidence" value={a.confidence ?? '—'} />
                            <KV label="Domain ID" value={<code className="text-xs">{a.domain_id ?? '—'}</code>} />
                            <KV label="SLA state" value={a.sla_state ?? '—'} />
                            <KV label="SLA breach" value={a.sla_breach_at
                                ? <span className={a.sla_breached ? 'text-red-700 font-semibold' : ''}>
                                    {formatDistanceToNow(parseISO(a.sla_breach_at), { addSuffix: true })}
                                  </span>
                                : '—'} />
                        </dl>
                        {a.description && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Description</div>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.description}</p>
                            </div>
                        )}
                        {a.remediation_hint && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Remediation hint</div>
                                <p className="text-sm text-slate-700">{a.remediation_hint}</p>
                            </div>
                        )}
                    </Card>

                    {a.evidence && Object.keys(a.evidence).length > 0 && (
                        <Card title="Evidence">
                            <pre className="text-xs bg-slate-50 rounded p-2 overflow-x-auto max-h-64">
                                {JSON.stringify(a.evidence, null, 2)}
                            </pre>
                        </Card>
                    )}

                    {a.mitre && Object.keys(a.mitre).length > 0 && (
                        <Card title="MITRE mapping">
                            <pre className="text-xs bg-slate-50 rounded p-2 overflow-x-auto max-h-32">
                                {JSON.stringify(a.mitre, null, 2)}
                            </pre>
                        </Card>
                    )}
                </div>

                <div className="space-y-4">
                    <Card title="Admin actions">
                        <div className="space-y-2">
                            <Btn onClick={() => setAction('transition')}>Transition status</Btn>
                            <Btn onClick={() => setAction('assign')}>Assign</Btn>
                            <Btn onClick={() => setAction('note')}>Add note</Btn>
                        </div>
                    </Card>

                    <Card title={`State changes (${detail.state_changes?.length ?? 0})`}>
                        {(detail.state_changes ?? []).length === 0 ? (
                            <p className="text-sm text-slate-500">No state changes yet.</p>
                        ) : (
                            <ol className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                                {[...detail.state_changes].reverse().map((s) => (
                                    <li key={s.id} className="text-xs border-l-2 border-slate-200 pl-2 py-0.5">
                                        <div className="font-medium text-slate-800">
                                            {s.from_status ?? '—'} → {s.to_status}
                                            {s.reason && <span className="text-slate-500"> · {s.reason}</span>}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            {s.actor_kind === 'user' ? s.actor_user_id : s.actor_kind}
                                            {' · '}
                                            {s.created_at ? formatDistanceToNow(parseISO(s.created_at), { addSuffix: true }) : '—'}
                                        </div>
                                        {s.note && (
                                            <div className="mt-1 text-slate-700 bg-slate-50 rounded p-1.5 text-[11px]">
                                                {s.note}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Card>
                </div>
            </div>

            {action && (
                <ActionModal action={action} alertId={a.id}
                    onClose={() => setAction(null)}
                    onSubmit={async (thunk) => { await dispatch(thunk); setAction(null); }} />
            )}
        </div>
    );
}

function ActionModal({ action, alertId, onClose, onSubmit }) {
    if (action === 'transition') return <TransitionForm alertId={alertId} onClose={onClose} onSubmit={onSubmit} />;
    if (action === 'assign')     return <AssignForm     alertId={alertId} onClose={onClose} onSubmit={onSubmit} />;
    if (action === 'note')       return <NoteForm       alertId={alertId} onClose={onClose} onSubmit={onSubmit} />;
    return null;
}

function TransitionForm({ alertId, onClose, onSubmit }) {
    const [to,      setTo]      = useState('acknowledged');
    const [reason,  setReason]  = useState('');
    const [note,    setNote]    = useState('');
    const isResolution = ['resolved', 'suppressed', 'false_positive', 'accepted_risk'].includes(to);
    return (
        <Modal title="Transition status" onClose={onClose}>
            <Field label="To"><select value={to} onChange={(e) => setTo(e.target.value)} className="form-input">
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select></Field>
            {isResolution && (
                <Field label="Reason">
                    <select value={reason} onChange={(e) => setReason(e.target.value)} className="form-input">
                        <option value="">(none)</option>
                        {RESOLVED_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                    </select>
                </Field>
            )}
            <Field label="Note (optional)">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="form-input" />
            </Field>
            <FormFooter onClose={onClose} onSubmit={() => onSubmit(transitionAlert({ id: alertId, to, reason: reason || undefined, note: note || undefined }))} />
            <ModalStyles />
        </Modal>
    );
}

function AssignForm({ alertId, onClose, onSubmit }) {
    const [userId, setUserId] = useState('');
    const [team,   setTeam]   = useState('');
    return (
        <Modal title="Assign alert" onClose={onClose}>
            <Field label="Admin user ID (blank to unassign)">
                <input value={userId} onChange={(e) => setUserId(e.target.value)} className="form-input font-mono" />
            </Field>
            <Field label="Team (optional)">
                <input value={team} onChange={(e) => setTeam(e.target.value)} className="form-input" />
            </Field>
            <FormFooter onClose={onClose} onSubmit={() => onSubmit(assignAlert({ id: alertId, userId: userId || null, team: team || null }))} />
            <ModalStyles />
        </Modal>
    );
}

function NoteForm({ alertId, onClose, onSubmit }) {
    const [note, setNote] = useState('');
    return (
        <Modal title="Add note" onClose={onClose}>
            <Field label="Note">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="form-input" />
            </Field>
            <FormFooter onClose={onClose} disabled={!note.trim()} onSubmit={() => onSubmit(addAlertNote({ id: alertId, note }))} />
            <ModalStyles />
        </Modal>
    );
}

function Modal({ title, children, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold">{title}</h3>
                    <button onClick={onClose} type="button" className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}

function FormFooter({ onClose, onSubmit, disabled }) {
    const [busy, setBusy] = useState(false);
    return (
        <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-700 hover:text-slate-900">Cancel</button>
            <button type="button" disabled={disabled || busy}
                onClick={async () => { setBusy(true); try { await onSubmit(); } finally { setBusy(false); } }}
                className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 text-white rounded-md disabled:opacity-50">
                {busy ? 'Saving…' : 'Submit'}
            </button>
        </div>
    );
}

function Btn({ children, ...props }) {
    return (
        <button type="button" {...props}
            className="w-full inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-md">
            {children}
        </button>
    );
}

function Card({ title, children }) {
    return (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                {title}
            </div>
            <div className="p-3">{children}</div>
        </div>
    );
}

function KV({ label, value }) {
    return (
        <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="text-sm text-slate-800">{value}</dd>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div className="mb-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
            {children}
        </div>
    );
}

function ModalStyles() {
    return <style>{`.form-input{width:100%;padding:.4rem .65rem;font-size:.875rem;border:1px solid #cbd5e1;border-radius:.375rem}`}</style>;
}
