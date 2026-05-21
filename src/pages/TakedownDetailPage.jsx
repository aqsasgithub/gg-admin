import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft, Sword, User, AlertTriangle, Clock, MessageSquare, Send,
    CheckCircle2, XCircle, Loader2, Plus, Globe, Tag, Pencil, Power,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchTakedown, assignTakedown, updateTakedownSeverity,
    updateTakedownMetadata, addTakedownNote,
    forceCloseTakedown, forceResolveTakedown,
    selectTakedown,
} from '../features/admin/adminTakedownsSlice';
import { TakedownStatusPill, SeverityPill } from './TakedownsPage';

const TERMINAL_STATUSES = ['resolved', 'expired', 'rejected', 'closed'];

const SUBMISSION_ICONS = {
    queued:       { Icon: Clock,         color: 'text-slate-500' },
    submitted:    { Icon: Send,          color: 'text-sky-600' },
    acknowledged: { Icon: CheckCircle2,  color: 'text-amber-600' },
    resolved:     { Icon: CheckCircle2,  color: 'text-emerald-600' },
    rejected:     { Icon: XCircle,       color: 'text-red-600' },
    expired:      { Icon: AlertTriangle, color: 'text-orange-600' },
    failed:       { Icon: XCircle,       color: 'text-red-700' },
};

export default function TakedownDetailPage() {
    const { id } = useParams();
    const dispatch = useDispatch();
    const detail = useSelector((s) => selectTakedown(s, id));

    const [action, setAction] = useState(null);  // {kind: 'note'|'severity'|'metadata'|'force-close'|'force-resolve'}

    useEffect(() => { dispatch(fetchTakedown(id)); }, [dispatch, id]);

    if (!detail) {
        return (
            <div className="p-6 text-center text-slate-500">
                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
            </div>
        );
    }

    const c = detail.case;
    const isTerminal = TERMINAL_STATUSES.includes(c.status);

    return (
        <div className="p-6 space-y-4">
            <div>
                <Link to="/takedowns" className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
                    <ArrowLeft size={14} /> Back to queue
                </Link>
            </div>

            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                        <Sword size={20} /> Takedown <code className="font-mono text-base">{c.id}</code>
                    </h1>
                    <p className="text-sm text-slate-600 mt-1">
                        Opened {c.created_at ? formatDistanceToNow(parseISO(c.created_at), { addSuffix: true }) : '—'}
                        {' · '}
                        <Link to={`/companies/${c.company_id}?tab=takedowns`} className="hover:underline">
                            {c.company_id}
                        </Link>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <TakedownStatusPill status={c.status} />
                    <SeverityPill severity={c.severity} />
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left: case info + targets + submissions + actions */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Summary card */}
                    <Card title="Case summary">
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <KV label="Abuse kind"
                                value={<span className="capitalize">{c.abuse_kind?.replace(/_/g, ' ')}</span>} />
                            <KV label="Notice kind"
                                value={<span className="capitalize">{c.notice_kind?.replace(/_/g, ' ') ?? '—'}</span>} />
                            <KV label="Protected brand" value={c.protected_brand ?? '—'} />
                            <KV label="Assigned to" value={detail.assigned_admin
                                ? <code className="text-xs">{detail.assigned_admin.email}</code>
                                : <span className="italic text-slate-500">unassigned</span>} />
                            <KV label="SLA due"
                                value={c.sla_due_at
                                    ? <span className={c.sla_breached ? 'text-red-700 font-semibold' : ''}>
                                        {formatDistanceToNow(parseISO(c.sla_due_at), { addSuffix: true })}
                                    </span>
                                    : '—'} />
                            <KV label="Last liveness probe"
                                value={c.last_liveness_probe_at
                                    ? formatDistanceToNow(parseISO(c.last_liveness_probe_at), { addSuffix: true })
                                    : '—'} />
                        </dl>
                        {c.summary && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Summary</div>
                                <p className="text-sm text-slate-700">{c.summary}</p>
                            </div>
                        )}
                        {c.tags?.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Tags</div>
                                <div className="flex flex-wrap gap-1">
                                    {c.tags.map((t) => (
                                        <span key={t} className="px-1.5 py-0.5 text-xs bg-slate-100 text-slate-700 rounded">
                                            <Tag size={9} className="inline mr-0.5" /> {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Targets */}
                    <Card title={`Targets (${detail.targets.length})`}>
                        {!detail.targets.length ? (
                            <p className="text-sm text-slate-500">No targets recorded.</p>
                        ) : (
                            <ul className="space-y-2">
                                {detail.targets.map((t) => (
                                    <li key={t.id} className="text-sm">
                                        <div className="flex items-start gap-2">
                                            <Globe size={13} className={t.is_live ? 'text-red-600' : 'text-emerald-600'} />
                                            <div className="flex-1 min-w-0">
                                                <code className="text-xs text-slate-800 break-all">{t.url}</code>
                                                <div className="text-[10px] text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                                                    {t.host && <span>host: <code>{t.host}</code></span>}
                                                    {t.registrar && <span>registrar: <code>{t.registrar}</code></span>}
                                                    {t.host_provider && <span>provider: <code>{t.host_provider}</code></span>}
                                                    {t.cdn && <span>cdn: <code>{t.cdn}</code></span>}
                                                </div>
                                            </div>
                                            <span className={`text-xs font-medium ${t.is_live ? 'text-red-700' : 'text-emerald-700'}`}>
                                                {t.is_live ? 'live' : 'dead'}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    {/* Submissions */}
                    <Card title={`Submissions (${detail.submissions.length})`}>
                        {!detail.submissions.length ? (
                            <p className="text-sm text-slate-500">No provider submissions yet.</p>
                        ) : (
                            <ul className="space-y-2">
                                {detail.submissions.map((s) => {
                                    const meta = SUBMISSION_ICONS[s.status] ?? SUBMISSION_ICONS.queued;
                                    const Icon = meta.Icon;
                                    return (
                                        <li key={s.id} className="flex items-start gap-2 text-sm">
                                            <Icon size={14} className={`flex-shrink-0 mt-0.5 ${meta.color}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium">
                                                    {s.provider_id} <span className="text-xs text-slate-500 capitalize">· {s.tier?.replace(/_/g, ' ')}</span>
                                                </div>
                                                <div className="text-xs text-slate-600">
                                                    <span className="capitalize font-medium">{s.status}</span>
                                                    {s.external_ticket_id && <span> · ticket <code>{s.external_ticket_id}</code></span>}
                                                    {s.external_status && <span> · {s.external_status}</span>}
                                                </div>
                                                {s.external_message && (
                                                    <div className="text-xs text-slate-500 mt-0.5 italic">"{s.external_message}"</div>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-500 whitespace-nowrap">
                                                {s.resolved_at
                                                    ? formatDistanceToNow(parseISO(s.resolved_at), { addSuffix: true })
                                                    : s.submitted_at
                                                        ? formatDistanceToNow(parseISO(s.submitted_at), { addSuffix: true })
                                                        : '—'}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Card>
                </div>

                {/* Right: timeline + admin actions */}
                <div className="space-y-4">
                    <Card title="Admin actions">
                        <div className="space-y-2">
                            <ActionButton icon={User} onClick={() => setAction({ kind: 'assign' })} disabled={isTerminal}>
                                {detail.assigned_admin ? 'Reassign' : 'Assign'}
                            </ActionButton>
                            <ActionButton icon={AlertTriangle} onClick={() => setAction({ kind: 'severity' })} disabled={isTerminal}>
                                Change severity
                            </ActionButton>
                            <ActionButton icon={Pencil} onClick={() => setAction({ kind: 'metadata' })} disabled={isTerminal}>
                                Edit metadata
                            </ActionButton>
                            <ActionButton icon={MessageSquare} onClick={() => setAction({ kind: 'note' })}>
                                Add note
                            </ActionButton>
                            <div className="pt-2 mt-2 border-t border-slate-200 space-y-2">
                                <ActionButton icon={CheckCircle2} variant="success"
                                    onClick={() => setAction({ kind: 'force-resolve' })}
                                    disabled={isTerminal}>
                                    Force-resolve
                                </ActionButton>
                                <ActionButton icon={Power} variant="destructive"
                                    onClick={() => setAction({ kind: 'force-close' })}
                                    disabled={isTerminal}>
                                    Force-close
                                </ActionButton>
                            </div>
                        </div>
                    </Card>

                    <Card title={`Timeline (${detail.events.length})`}>
                        {!detail.events.length ? (
                            <p className="text-sm text-slate-500">No events yet.</p>
                        ) : (
                            <ol className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                                {detail.events.slice().reverse().map((e) => (
                                    <li key={e.id} className="text-xs border-l-2 border-slate-200 pl-2 py-0.5">
                                        <div className="font-medium text-slate-800">
                                            {e.event_type.replace(/[._]/g, ' ')}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            {e.actor_kind === 'user' ? e.actor_label : e.actor_kind}
                                            {' · '}
                                            {e.occurred_at ? formatDistanceToNow(parseISO(e.occurred_at), { addSuffix: true }) : '—'}
                                        </div>
                                        {e.payload?.note && (
                                            <div className="mt-1 text-slate-700 bg-slate-50 rounded p-1.5 text-[11px]">
                                                {e.payload.note}
                                            </div>
                                        )}
                                        {e.payload?.reason && (
                                            <div className="mt-0.5 italic text-slate-600 text-[11px]">
                                                reason: {e.payload.reason}
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
                <ActionModal action={action} caseId={c.id}
                    currentSeverity={c.severity} currentMetadata={c}
                    onClose={() => setAction(null)}
                    onSubmit={async (thunk) => {
                        await dispatch(thunk);
                        setAction(null);
                    }} />
            )}
        </div>
    );
}

function ActionModal({ action, caseId, currentSeverity, currentMetadata, onClose, onSubmit }) {
    const titles = {
        assign:          'Assign takedown',
        severity:        'Change severity',
        metadata:        'Edit metadata',
        note:            'Add note',
        'force-close':   'Force-close case',
        'force-resolve': 'Force-resolve case',
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold">{titles[action.kind]}</h3>
                    <button onClick={onClose} type="button" className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="p-5">
                    {action.kind === 'assign'           && <AssignForm caseId={caseId} onSubmit={onSubmit} />}
                    {action.kind === 'severity'         && <SeverityForm caseId={caseId} current={currentSeverity} onSubmit={onSubmit} />}
                    {action.kind === 'metadata'         && <MetadataForm caseId={caseId} current={currentMetadata} onSubmit={onSubmit} />}
                    {action.kind === 'note'             && <NoteForm caseId={caseId} onSubmit={onSubmit} />}
                    {action.kind === 'force-close'      && <ForceForm kind="close" caseId={caseId} onSubmit={onSubmit} />}
                    {action.kind === 'force-resolve'    && <ForceForm kind="resolve" caseId={caseId} onSubmit={onSubmit} />}
                </div>
            </div>
        </div>
    );
}

function AssignForm({ caseId, onSubmit }) {
    const [userId, setUserId] = useState('');
    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(assignTakedown({ id: caseId, userId: userId || null })); }}>
            <Field label="Admin user ID (blank to unassign)">
                <input value={userId} onChange={(e) => setUserId(e.target.value)} className="form-input font-mono" />
            </Field>
            <SubmitRow label="Assign" />
        </form>
    );
}

function SeverityForm({ caseId, current, onSubmit }) {
    const [severity, setSeverity] = useState(current ?? 'high');
    const [reason, setReason] = useState('');
    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(updateTakedownSeverity({ id: caseId, severity, reason })); }}>
            <Field label="Severity">
                <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="form-input">
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
            </Field>
            <Field label="Reason (audit, optional)">
                <input value={reason} onChange={(e) => setReason(e.target.value)} className="form-input" />
            </Field>
            <SubmitRow label="Save" disabled={severity === current} />
        </form>
    );
}

function MetadataForm({ caseId, current, onSubmit }) {
    const [summary, setSummary]       = useState(current.summary ?? '');
    const [noticeKind, setNoticeKind] = useState(current.notice_kind ?? 'abuse_report');
    const [tagsCsv, setTagsCsv]       = useState((current.tags ?? []).join(', '));
    const [slaDueAt, setSlaDueAt]     = useState(current.sla_due_at ? current.sla_due_at.slice(0, 16) : '');
    const [reason, setReason]         = useState('');

    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            onSubmit(updateTakedownMetadata({
                id: caseId, summary, notice_kind: noticeKind,
                tags: tagsCsv.split(',').map((t) => t.trim()).filter(Boolean),
                sla_due_at: slaDueAt ? new Date(slaDueAt).toISOString() : null,
                reason: reason || null,
            }));
        }}>
            <Field label="Summary">
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="form-input" />
            </Field>
            <Field label="Notice kind">
                <select value={noticeKind} onChange={(e) => setNoticeKind(e.target.value)} className="form-input">
                    <option value="abuse_report">Abuse report</option>
                    <option value="dmca">DMCA</option>
                    <option value="trademark">Trademark</option>
                    <option value="gdpr">GDPR</option>
                    <option value="law_enforcement">Law enforcement</option>
                </select>
            </Field>
            <Field label="Tags (comma-separated)">
                <input value={tagsCsv} onChange={(e) => setTagsCsv(e.target.value)} className="form-input" />
            </Field>
            <Field label="SLA due (local time)">
                <input type="datetime-local" value={slaDueAt} onChange={(e) => setSlaDueAt(e.target.value)} className="form-input" />
            </Field>
            <Field label="Reason (audit, optional)">
                <input value={reason} onChange={(e) => setReason(e.target.value)} className="form-input" />
            </Field>
            <SubmitRow label="Save" />
            <Styles />
        </form>
    );
}

function NoteForm({ caseId, onSubmit }) {
    const [note, setNote] = useState('');
    const [visibility, setVisibility] = useState('internal');
    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(addTakedownNote({ id: caseId, note, visibility })); }}>
            <Field label="Note">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="form-input" />
            </Field>
            <Field label="Visibility">
                <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="form-input">
                    <option value="internal">Internal (admin only)</option>
                    <option value="customer">Customer-visible</option>
                </select>
            </Field>
            <SubmitRow label="Add note" disabled={!note.trim()} />
            <Styles />
        </form>
    );
}

function ForceForm({ kind, caseId, onSubmit }) {
    const [reason, setReason] = useState('');
    const valid = reason.trim().length >= 10;
    const thunkFor = kind === 'close' ? forceCloseTakedown : forceResolveTakedown;
    return (
        <form onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(thunkFor({ id: caseId, reason })); }}>
            <p className="text-sm text-slate-700 mb-3">
                {kind === 'close'
                    ? 'Mark this case as closed. Use when the case is no longer relevant (duplicate, customer dropped, etc.).'
                    : 'Mark this case as resolved manually. Use when the takedown succeeded but the automation didn\'t pick it up.'}
            </p>
            <Field label="Reason (≥10 chars, recorded in audit)">
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="form-input" />
            </Field>
            <SubmitRow label={kind === 'close' ? 'Force-close' : 'Force-resolve'} disabled={!valid}
                       destructive={kind === 'close'} />
            <Styles />
        </form>
    );
}

function ActionButton({ icon: Icon, children, variant = 'default', ...props }) {
    const styles = {
        default:     'border-slate-200 text-slate-700 hover:bg-slate-50',
        success:     'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
        destructive: 'border-red-200 text-red-700 hover:bg-red-50',
    };
    return (
        <button type="button"
            className={`w-full inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md disabled:opacity-50 ${styles[variant]}`}
            {...props}>
            <Icon size={14} /> {children}
        </button>
    );
}

function SubmitRow({ label, disabled, destructive }) {
    return (
        <div className="mt-4 flex justify-end">
            <button type="submit" disabled={disabled}
                className={`px-4 py-1.5 text-sm font-medium rounded-md disabled:opacity-50 text-white ${
                    destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-guardian-navy hover:bg-guardian-navy-800'
                }`}>
                {label}
            </button>
        </div>
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

function Styles() {
    return <style>{`.form-input{width:100%;padding:.4rem .65rem;font-size:.875rem;border:1px solid #cbd5e1;border-radius:.375rem}`}</style>;
}
