import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Mail, RefreshCcw, Search, X, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    fetchEmailLogs, fetchEmailLogStats, fetchEmailLogDetail, resendEmailLog,
    setEmailLogFilter, clearEmailLogFilters, setEmailLogPage,
    closeEmailLogDetail,
    selectEmailLogs, selectEmailLogMeta, selectEmailLogStats, selectEmailLogDetail,
    selectEmailLogLoading, selectEmailLogResending, selectEmailLogError,
    selectEmailLogFilters, selectEmailLogPage,
} from '../features/admin/emailLogsSlice';
import { selectAdminCapabilities } from '../features/auth/authSlice';

/**
 * Email delivery logs.
 *
 *   /email-logs
 *
 * Central record of every outgoing email with its delivery lifecycle
 * (pending → sent → delivered → opened/clicked, or bounced/blocked/spam/
 * deferred). The lifecycle is PROVIDER-NEUTRAL: whichever provider is active
 * (Mailjet, Brevo, Postmark or SMTP2GO) reports its own events, which the server
 * normalises into the single status vocabulary rendered here.
 *
 * Failed/bounced messages can be resent (owner only); a resend creates a new
 * linked record so the audit chain is preserved, and always goes out through
 * the CURRENTLY configured provider.
 */

const STATUS_STYLES = {
    delivered: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    opened:    'bg-sky-100 text-sky-800 ring-sky-200',
    clicked:   'bg-indigo-100 text-indigo-800 ring-indigo-200',
    sent:      'bg-slate-100 text-slate-700 ring-slate-200',
    pending:   'bg-amber-100 text-amber-800 ring-amber-200',
    queued:    'bg-amber-100 text-amber-800 ring-amber-200',
    deferred:  'bg-amber-100 text-amber-800 ring-amber-200',
    failed:    'bg-red-100 text-red-800 ring-red-200',
    bounced:   'bg-red-100 text-red-800 ring-red-200',
    blocked:   'bg-red-100 text-red-800 ring-red-200',
    spam:      'bg-red-100 text-red-800 ring-red-200',
    unsubscribed: 'bg-slate-200 text-slate-600 ring-slate-300',
};

const RESENDABLE = ['failed', 'bounced', 'blocked', 'spam', 'deferred'];

// How each webhook-processing outcome reads in the event list. 'duplicate' is
// a provider redelivery that idempotency correctly discarded — informational,
// not an error.
const RESULT_TONE = {
    applied:   'text-emerald-600',
    ignored:   'text-slate-400',
    duplicate: 'text-sky-600',
    unmatched: 'text-amber-600',
    error:     'text-red-600',
};

function StatusPill({ status }) {
    const cls = STATUS_STYLES[status] || 'bg-slate-100 text-slate-700 ring-slate-200';
    return <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ring-1 capitalize ${cls}`}>{status}</span>;
}

const fmt = (v) => (v ? new Date(v).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export default function EmailLogsPage() {
    const dispatch = useDispatch();
    const logs      = useSelector(selectEmailLogs);
    const meta      = useSelector(selectEmailLogMeta);
    const stats     = useSelector(selectEmailLogStats);
    const detail    = useSelector(selectEmailLogDetail);
    const loading   = useSelector(selectEmailLogLoading);
    const resending = useSelector(selectEmailLogResending);
    const error     = useSelector(selectEmailLogError);
    const filters   = useSelector(selectEmailLogFilters);
    const page      = useSelector(selectEmailLogPage);
    const caps      = useSelector(selectAdminCapabilities);

    const canResend = caps.includes('*') || caps.includes('email_logs.resend');

    useEffect(() => { dispatch(fetchEmailLogStats()); }, [dispatch]);
    useEffect(() => { dispatch(fetchEmailLogs({ filters, page })); }, [dispatch, filters, page]);

    const activeFilters = useMemo(
        () => Object.values(filters).filter((v) => v !== '' && v != null).length,
        [filters],
    );

    const STATUS_TABS = ['', 'delivered', 'opened', 'sent', 'bounced', 'failed'];

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                    <Mail size={22} /> Email delivery logs
                </h1>
                <p className="text-sm text-slate-600">
                    Every outgoing email and its delivery status. Failed or bounced messages can be resent.
                </p>
            </header>

            {/* Summary strip */}
            {stats?.counts && (
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    {[
                        ['Total', stats.total, 'text-slate-800'],
                        ['Delivered', stats.counts.delivered, 'text-emerald-700'],
                        ['Opened', stats.counts.opened, 'text-sky-700'],
                        ['Sent', stats.counts.sent, 'text-slate-700'],
                        ['Bounced', stats.counts.bounced, 'text-red-700'],
                        ['Failed', stats.counts.failed, 'text-red-700'],
                    ].map(([label, value, c]) => (
                        <div key={label} className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                            <div className={`text-lg font-semibold ${c}`}>{value ?? 0}</div>
                            <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3">
                <div className="relative max-w-md">
                    <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                        type="text"
                        value={filters.q}
                        onChange={(e) => dispatch(setEmailLogFilter({ key: 'q', value: e.target.value }))}
                        placeholder="Search recipient or subject"
                        className="w-full pl-8 pr-8 py-2 text-sm border border-slate-300 rounded-md"
                    />
                    {filters.q && (
                        <button type="button" onClick={() => dispatch(setEmailLogFilter({ key: 'q', value: '' }))}
                            className="absolute right-2 top-2 text-slate-400 hover:text-slate-700" aria-label="Clear search">
                            <X size={16} />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {STATUS_TABS.map((s) => (
                        <button key={s || 'all'} type="button"
                            onClick={() => dispatch(setEmailLogFilter({ key: 'status', value: s }))}
                            className={`px-2.5 py-1 text-xs rounded-full ring-1 transition ${
                                filters.status === s
                                    ? 'bg-guardian-navy text-white ring-guardian-navy'
                                    : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                            }`}>
                            {s === '' ? 'All statuses' : s}
                        </button>
                    ))}
                    {activeFilters > 0 && (
                        <button type="button" onClick={() => dispatch(clearEmailLogFilters())}
                            className="text-xs text-slate-500 hover:text-slate-800 underline ml-1">Clear filters</button>
                    )}
                    <button type="button" onClick={() => { dispatch(fetchEmailLogs({ filters, page })); dispatch(fetchEmailLogStats()); }}
                        disabled={loading}
                        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50">
                        <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md px-4 py-2">{error}</div>}

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                            <th className="text-left font-semibold px-3 py-2.5">Recipient</th>
                            <th className="text-left font-semibold px-3 py-2.5">Subject</th>
                            <th className="text-left font-semibold px-3 py-2.5 w-32">Type</th>
                            <th className="text-left font-semibold px-3 py-2.5 w-28">Status</th>
                            <th className="text-left font-semibold px-3 py-2.5 w-36">Sent</th>
                            <th className="w-12 px-3 py-2.5"><span className="sr-only">Actions</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Loading…</td></tr>}
                        {!loading && logs.length === 0 && (
                            <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No emails match the current filters.</td></tr>
                        )}
                        {!loading && logs.map((log) => (
                            <tr key={log.id} onClick={() => dispatch(fetchEmailLogDetail(log.id))} className="hover:bg-slate-50 cursor-pointer">
                                <td className="px-3 py-2.5 text-slate-800">{log.recipient}</td>
                                <td className="px-3 py-2.5 text-slate-600 max-w-xs truncate">{log.subject || '—'}</td>
                                <td className="px-3 py-2.5 text-slate-600">{String(log.email_type || '').replace(/_/g, ' ')}</td>
                                <td className="px-3 py-2.5"><StatusPill status={log.status} /></td>
                                <td className="px-3 py-2.5 text-slate-500 text-xs">{fmt(log.sent_at || log.created_at)}</td>
                                <td className="px-3 py-2.5 text-right">
                                    {canResend && RESENDABLE.includes(log.status) && (
                                        <button type="button"
                                            onClick={(e) => { e.stopPropagation(); dispatch(resendEmailLog(log.id)); }}
                                            disabled={resending === log.id}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 rounded-md hover:bg-white disabled:opacity-50"
                                            title="Resend this email">
                                            <Send size={12} className={resending === log.id ? 'animate-pulse' : ''} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {meta && meta.last_page > 1 && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Page {meta.current_page} of {meta.last_page} · {meta.total} emails</span>
                    <div className="flex items-center gap-1">
                        <button type="button" disabled={page <= 1} onClick={() => dispatch(setEmailLogPage(page - 1))}
                            className="p-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={15} /></button>
                        <button type="button" disabled={page >= meta.last_page} onClick={() => dispatch(setEmailLogPage(page + 1))}
                            className="p-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={15} /></button>
                    </div>
                </div>
            )}

            {detail && <EmailDetail log={detail} canResend={canResend} resending={resending}
                onResend={() => dispatch(resendEmailLog(detail.id))} onClose={() => dispatch(closeEmailLogDetail())} />}
        </div>
    );
}

function EmailDetail({ log, canResend, resending, onResend, onClose }) {
    const chain = Array.isArray(log.resends) ? log.resends : [];
    const events = log.provider_response?.events || [];
    const webhookEvents = Array.isArray(log.webhookEvents) ? log.webhookEvents
        : (Array.isArray(log.webhook_events) ? log.webhook_events : []);
    const attachments = Array.isArray(log.attachments) ? log.attachments : [];

    // Sender identity, persisted per-message so a historical email shows the
    // address it actually went out under rather than today's MAIL_FROM_ADDRESS.
    const fromLabel = log.from_address
        ? (log.from_name ? `${log.from_name} <${log.from_address}>` : log.from_address)
        : null;

    // Lifecycle timeline built from the log's own timestamps — always ordered.
    const timeline = [
        ['Created',   log.created_at],
        ['Sent',      log.sent_at],
        ['Delivered', log.delivered_at],
        ['Opened',    log.opened_at],
        ['Clicked',   log.clicked_at],
        ['Failed',    log.failed_at],
    ].filter(([, t]) => !!t);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl max-h-[88vh] flex flex-col">
                <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <StatusPill status={log.status} />
                            <span className="text-xs text-slate-500">{String(log.email_type || '').replace(/_/g, ' ')}</span>
                        </div>
                        <h3 className="text-base font-semibold text-guardian-navy mt-1">{log.subject || '(no subject)'}</h3>
                        <p className="text-sm text-slate-600">{log.recipient}</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none shrink-0" aria-label="Close">×</button>
                </div>
                <div className="p-5 overflow-auto space-y-5">
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <Field k="Provider" v={log.provider} />
                        <Field k="Mailer" v={log.mailer} />
                        <Field k="From" v={fromLabel} />
                        <Field k="Message-ID" v={log.smtp_message_id} />
                        <Field k="Message ID" v={log.provider_message_id} mono />
                        <Field k="Custom ID" v={log.custom_id} mono />
                        <Field k="Mail class" v={log.mail_class} mono />
                        <Field k="Notification" v={log.notification_class} mono />
                        <Field k="Company" v={log.company_id} mono />
                        <Field k="Assessment" v={log.assessment_id} mono />
                        {log.failure_reason && <Field k="Failure reason" v={log.failure_reason} />}
                        {log.retry_count > 0 && <Field k="Retry #" v={log.retry_count} />}
                    </dl>

                    {/* Lifecycle timeline */}
                    {timeline.length > 0 && (
                        <section>
                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Timeline</h4>
                            <ol className="relative border-l border-slate-200 ml-2 space-y-2">
                                {timeline.map(([label, t]) => (
                                    <li key={label} className="ml-3 text-xs text-slate-600">
                                        <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-guardian-navy" />
                                        <span className="font-medium text-slate-700">{label}</span>
                                        <span className="text-slate-400"> · {fmt(t)}</span>
                                    </li>
                                ))}
                            </ol>
                        </section>
                    )}

                    {/* Webhook history */}
                    {webhookEvents.length > 0 && (
                        <section>
                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Webhook events</h4>
                            <ul className="space-y-1">
                                {webhookEvents.map((w) => (
                                    <li key={w.id} className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-[11px] px-1.5 py-0.5 bg-slate-100 rounded">{w.provider}</span>
                                        <span className="text-slate-700">{w.event_type}</span>
                                        {w.mapped_status && <StatusPill status={w.mapped_status} />}
                                        <span className={`text-[10px] ${RESULT_TONE[w.result] || 'text-slate-400'}`}>{w.result}</span>
                                        <span className="text-slate-400">{fmt(w.created_at)}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Provider event summary (from provider_response) */}
                    {events.length > 0 && webhookEvents.length === 0 && (
                        <section>
                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Provider events</h4>
                            <ul className="space-y-1">
                                {events.map((e, i) => (
                                    <li key={i} className="text-xs text-slate-600 flex items-center gap-2">
                                        <StatusPill status={e.status} /> <span className="text-slate-400">{fmt(e.at)}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Resend history */}
                    {chain.length > 0 && (
                        <section>
                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Resends</h4>
                            <ul className="space-y-1">
                                {chain.map((r) => (
                                    <li key={r.id} className="text-xs text-slate-600 flex items-center gap-2">
                                        <StatusPill status={r.status} /> <span className="text-slate-400">{fmt(r.created_at)}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Attachments (metadata) */}
                    {attachments.length > 0 && (
                        <section>
                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Attachments</h4>
                            <ul className="space-y-1">
                                {attachments.map((a, i) => (
                                    <li key={i} className="text-xs text-slate-600">{a.name} <span className="text-slate-400">· {a.mime} · {a.size} bytes</span></li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Payload preview */}
                    {(log.html_body || log.text_body) && (
                        <section>
                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Payload</h4>
                            {log.html_body
                                ? <iframe title="email-html" srcDoc={log.html_body} className="w-full h-64 border border-slate-200 rounded-md bg-white" sandbox="" />
                                : <pre className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-3 whitespace-pre-wrap max-h-64 overflow-auto">{log.text_body}</pre>}
                        </section>
                    )}
                </div>
                {canResend && RESENDABLE.includes(log.status) && (
                    <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
                        <button type="button" onClick={onResend} disabled={resending === log.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-guardian-navy text-guardian-navy rounded-md hover:bg-slate-50 disabled:opacity-50">
                            <Send size={14} className={resending === log.id ? 'animate-pulse' : ''} /> Resend email
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function Field({ k, v, mono }) {
    if (v == null || v === '') return null;
    return (
        <div className="min-w-0">
            <dt className="text-[11px] text-slate-500">{k}</dt>
            <dd className={`text-sm text-slate-800 break-words ${mono ? 'font-mono text-xs' : ''}`}>{String(v)}</dd>
        </div>
    );
}
