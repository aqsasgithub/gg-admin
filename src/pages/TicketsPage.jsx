import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Ticket as TicketIcon, Loader2, ExternalLink, RefreshCw, XCircle, RotateCcw, ArrowUpCircle, Plus } from 'lucide-react';
import {
    fetchTicketControl, ticketControlAction, createTicket,
    selectTicketControl, selectTicketControlMeta, selectTicketControlLoading, selectTicketControlActing,
} from '../features/admin/adminTicketControlSlice';
import { selectAdminCapabilities } from '../features/auth/authSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';

const INTEGRATIONS = [
    { value: 'jira', label: 'Jira' }, { value: 'servicenow', label: 'ServiceNow' },
    { value: 'pagerduty', label: 'PagerDuty' }, { value: 'slack', label: 'Slack' }, { value: 'webhook', label: 'Webhook' },
];

export default function TicketsPage() {
    const dispatch = useDispatch();
    const list    = useSelector(selectTicketControl);
    const meta    = useSelector(selectTicketControlMeta);
    const loading = useSelector(selectTicketControlLoading);
    const acting  = useSelector(selectTicketControlActing);
    const caps    = useSelector(selectAdminCapabilities);
    const can = (c) => caps.includes('*') || caps.includes(c);
    const canWrite = can('tickets.write');

    const [filters, setFilters] = useState({});
    const [showCreate, setShowCreate] = useState(false);

    const reload = () => dispatch(fetchTicketControl(filters));
    useEffect(() => { reload(); }, [dispatch, JSON.stringify(filters)]);

    const act = async (id, action) => { await dispatch(ticketControlAction({ id, action })); reload(); };

    return (
        <div className="p-6 space-y-4">
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2"><TicketIcon size={22} /> Tickets — Control</h1>
                    <p className="text-sm text-slate-600 max-w-3xl">Create, close, reopen, escalate and re-sync external tickets directly. Changes are audited; external systems are synced via the integration adapters.</p>
                </div>
                {canWrite && (
                    <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-guardian-navy text-white text-sm hover:bg-guardian-navy-800"><Plus size={14} /> New ticket</button>
                )}
            </header>

            <AdminFilterBar
                filters={[
                    { key: 'integration', type: 'select', label: 'Integration', options: INTEGRATIONS },
                    { key: 'external_status', type: 'text', label: 'Status', placeholder: 'open / closed…' },
                ]}
                value={filters} onChange={setFilters} onClear={() => setFilters({})}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                        <tr>
                            <th className="text-left px-3 py-2">Ticket</th>
                            <th className="text-left px-3 py-2">Integration</th>
                            <th className="text-left px-3 py-2">Status</th>
                            <th className="text-right px-3 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400"><Loader2 className="inline animate-spin mr-2" size={16} /> Loading…</td></tr>}
                        {!loading && list.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">No tickets.</td></tr>}
                        {!loading && list.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2">
                                    <div className="font-medium text-slate-800 flex items-center gap-1">{t.external_id || t.id}
                                        {t.external_url && <a href={t.external_url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-guardian-navy"><ExternalLink size={12} /></a>}
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{t.integration}</td>
                                <td className="px-3 py-2 text-slate-600">{t.external_status || '—'}</td>
                                <td className="px-3 py-2 text-right">
                                    {canWrite ? (
                                        <div className="inline-flex gap-1">
                                            <ActBtn icon={XCircle}      label="Close"   onClick={() => act(t.id, 'close')} disabled={acting} />
                                            <ActBtn icon={RotateCcw}    label="Reopen"  onClick={() => act(t.id, 'reopen')} disabled={acting} />
                                            <ActBtn icon={ArrowUpCircle} label="Escalate" onClick={() => act(t.id, 'escalate')} disabled={acting} amber />
                                            <ActBtn icon={RefreshCw}    label="Re-sync" onClick={() => act(t.id, 'retry-sync')} disabled={acting} />
                                        </div>
                                    ) : <span className="text-xs text-slate-400">View only</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {meta && <div className="text-xs text-slate-500">{meta.total} tickets</div>}

            {showCreate && canWrite && (
                <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); reload(); }} />
            )}
        </div>
    );
}

function ActBtn({ icon: Icon, label, onClick, disabled, amber }) {
    return (
        <button onClick={onClick} disabled={disabled} title={label}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${amber ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} disabled:opacity-50`}>
            <Icon size={12} /> {label}
        </button>
    );
}

function CreateTicketModal({ onClose, onCreated }) {
    const dispatch = useDispatch();
    const [integration, setIntegration] = useState('jira');
    const [externalId, setExternalId] = useState('');
    const [busy, setBusy] = useState(false);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-semibold text-slate-900">New ticket</h3>
                <label className="block text-sm">Integration
                    <select value={integration} onChange={(e) => setIntegration(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm">
                        {INTEGRATIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </label>
                <label className="block text-sm">External ID (optional)
                    <input value={externalId} onChange={(e) => setExternalId(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                </label>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-700">Cancel</button>
                    <button disabled={busy} onClick={async () => { setBusy(true); try { await dispatch(createTicket({ integration, external_id: externalId || undefined })); onCreated(); } finally { setBusy(false); } }}
                        className="px-3 py-1.5 text-sm text-white rounded bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50">Create</button>
                </div>
            </div>
        </div>
    );
}
