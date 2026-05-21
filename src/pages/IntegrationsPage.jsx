import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Plug, Loader2, AlertCircle, Check, X, Pause, Power } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchIntegrations, fetchIntegrationStats,
    enableIntegration, disableIntegration, disconnectIntegration,
    selectIntegrations, selectIntegrationsMeta, selectIntegrationsLoading, selectIntegrationsStats,
} from '../features/admin/adminIntegrationsSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';

const INTEGRATION_OPTIONS = [
    { value: 'jira',       label: 'Jira' },
    { value: 'servicenow', label: 'ServiceNow' },
    { value: 'slack',      label: 'Slack' },
    { value: 'teams',      label: 'MS Teams' },
    { value: 'pagerduty',  label: 'PagerDuty' },
    { value: 'webhook',    label: 'Webhook' },
    { value: 'email',      label: 'Email' },
];

export default function IntegrationsPage() {
    const dispatch = useDispatch();
    const list    = useSelector(selectIntegrations);
    const meta    = useSelector(selectIntegrationsMeta);
    const loading = useSelector(selectIntegrationsLoading);
    const stats   = useSelector(selectIntegrationsStats);

    const [filters, setFilters] = useState({});
    const [page,    setPage]    = useState(1);
    const [action,  setAction]  = useState(null);  // {kind: 'disable'|'disconnect'|'enable', integration}

    useEffect(() => { dispatch(fetchIntegrations({ ...filters, page, per_page: 50 })); }, [dispatch, filters, page]);
    useEffect(() => { dispatch(fetchIntegrationStats()); }, [dispatch]);

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                    <Plug size={22} /> Integrations
                </h1>
                <p className="text-sm text-slate-600">
                    Cross-tenant integration health (Jira, ServiceNow, Slack, Teams, PagerDuty, Webhook, Email).
                    Disable preserves credentials; disconnect clears them.
                </p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat label="Total"             value={stats?.total ?? '—'} />
                <Stat label="Enabled"           value={stats?.by_status?.enabled ?? '—'} />
                <Stat label="Failing"           value={stats?.by_status?.failing ?? '—'}
                      tone={(stats?.by_status?.failing ?? 0) > 0 ? 'critical' : 'default'} />
                <Stat label="Tokens expiring"   value={stats?.tokens_expiring ?? '—'} />
                <Stat label="Tokens expired"    value={stats?.tokens_expired ?? '—'}
                      tone={(stats?.tokens_expired ?? 0) > 0 ? 'critical' : 'default'} />
            </div>

            <AdminFilterBar
                filters={[
                    { key: 'search',      type: 'text',   label: 'Search', placeholder: 'ID, display name…' },
                    { key: 'integration', type: 'select', label: 'Integration', options: INTEGRATION_OPTIONS },
                    { key: 'enabled',     type: 'select', label: 'Enabled',
                      options: [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }] },
                    { key: 'failing',     type: 'boolean', label: 'Failing only' },
                ]}
                value={filters}
                onChange={(v) => { setFilters(v); setPage(1); }}
                onClear={() => { setFilters({}); setPage(1); }}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Integration</th>
                            <th className="px-3 py-2 text-left">Company</th>
                            <th className="px-3 py-2 text-center">State</th>
                            <th className="px-3 py-2 text-left">Last used</th>
                            <th className="px-3 py-2 text-left">Failures</th>
                            <th className="px-3 py-2 text-left">Token expires</th>
                            <th className="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !list.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">No integrations match.</td></tr>
                        ) : list.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50/50">
                                <td className="px-3 py-2.5">
                                    <div className="font-medium text-slate-900 capitalize">{c.integration}</div>
                                    {c.display_name && <div className="text-xs text-slate-500">{c.display_name}</div>}
                                </td>
                                <td className="px-3 py-2.5">
                                    <Link to={`/companies/${c.company_id}?tab=integrations`}
                                        className="text-xs font-mono text-slate-700 hover:underline">
                                        {c.company_id}
                                    </Link>
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
                                <td className="px-3 py-2.5 text-xs text-slate-500">
                                    {c.token_expires_at
                                        ? formatDistanceToNow(parseISO(c.token_expires_at), { addSuffix: true })
                                        : <span className="text-slate-400">—</span>}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                    <div className="inline-flex items-center gap-1">
                                        {c.enabled
                                            ? <button type="button" onClick={() => setAction({ kind: 'disable', integration: c })}
                                                className="px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 rounded">
                                                <Pause size={11} className="inline mr-0.5" /> Disable
                                              </button>
                                            : <button type="button" onClick={() => setAction({ kind: 'enable', integration: c })}
                                                className="px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 rounded">
                                                <Check size={11} className="inline mr-0.5" /> Enable
                                              </button>}
                                        <button type="button" onClick={() => setAction({ kind: 'disconnect', integration: c })}
                                            className="px-2 py-1 text-xs text-red-700 hover:bg-red-50 rounded">
                                            <Power size={11} className="inline mr-0.5" /> Disconnect
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {meta && meta.last_page > 1 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-sm">
                        <div className="text-slate-600">Page {meta.current_page} of {meta.last_page} · {meta.total}</div>
                        <div className="flex gap-1">
                            <button type="button" disabled={meta.current_page <= 1}
                                onClick={() => setPage((p) => p - 1)} className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40">Previous</button>
                            <button type="button" disabled={meta.current_page >= meta.last_page}
                                onClick={() => setPage((p) => p + 1)} className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40">Next</button>
                        </div>
                    </div>
                )}
            </div>

            {action && (
                <ActionModal action={action} onClose={() => setAction(null)}
                    onConfirm={async (reason) => {
                        const { kind, integration } = action;
                        if (kind === 'enable')      await dispatch(enableIntegration(integration.id));
                        if (kind === 'disable')     await dispatch(disableIntegration({ id: integration.id, reason }));
                        if (kind === 'disconnect')  await dispatch(disconnectIntegration({ id: integration.id, reason }));
                        setAction(null);
                        dispatch(fetchIntegrations({ ...filters, page, per_page: 50 }));
                    }} />
            )}
        </div>
    );
}

function ActionModal({ action, onClose, onConfirm }) {
    const [reason, setReason] = useState('');
    const [busy,   setBusy]   = useState(false);
    const needsReason = action.kind !== 'enable';
    const minLen = action.kind === 'disconnect' ? 10 : 5;
    const valid = !needsReason || reason.length >= minLen;

    const titles = {
        enable:     `Enable ${action.integration.integration}`,
        disable:    `Disable ${action.integration.integration}`,
        disconnect: `Force-disconnect ${action.integration.integration}`,
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h3 className="text-base font-semibold">{titles[action.kind]}</h3>
                </div>
                <div className="p-5">
                    {action.kind === 'disable' && (
                        <p className="text-sm text-slate-700 mb-3">
                            Credentials preserved — the tenant can re-enable without re-authenticating.
                        </p>
                    )}
                    {action.kind === 'disconnect' && (
                        <p className="text-sm text-red-700 mb-3">
                            Clears stored credentials. The tenant will need to re-authenticate to use this integration again.
                        </p>
                    )}
                    {needsReason && (
                        <>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Reason (≥{minLen} chars, audited)</label>
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

function Stat({ label, value, tone = 'default' }) {
    const tones = { critical: 'text-red-600', default: 'text-guardian-navy' };
    return (
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className={`mt-0.5 text-xl font-semibold ${tones[tone]}`}>{value}</div>
        </div>
    );
}
