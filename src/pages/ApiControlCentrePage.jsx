import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Radio, Loader2, Power, PlayCircle, X, KeyRound } from 'lucide-react';
import {
    fetchProviders, fetchProvider, updateProvider, providerAction,
    selectProviders, selectProvidersLoading, selectProvider, selectApiControlActing,
} from '../features/admin/adminApiControlSlice';

const CATEGORY_BADGE = {
    scanner: 'bg-blue-100 text-blue-800',
    calculator: 'bg-purple-100 text-purple-800',
    integration: 'bg-emerald-100 text-emerald-800',
    internal: 'bg-slate-100 text-slate-700',
};

export default function ApiControlCentrePage() {
    const dispatch = useDispatch();
    const providers = useSelector(selectProviders);
    const loading   = useSelector(selectProvidersLoading);
    const [openId, setOpenId] = useState(null);

    useEffect(() => { dispatch(fetchProviders()); }, [dispatch]);

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                    <Radio size={22} /> API Control Centre
                </h1>
                <p className="text-sm text-slate-600 max-w-3xl">
                    Operate every scanner, calculator, and integration: global config, rate limits, governance toggles
                    (whether output is visible / affects score / can create tickets), per-tenant overrides, probes, and raw
                    response history. Secrets are referenced, never shown. Disabling a provider globally requires approval.
                </p>
            </header>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                        <tr>
                            <th className="text-left px-3 py-2">Provider</th>
                            <th className="text-left px-3 py-2">Category</th>
                            <th className="text-left px-3 py-2">Mode</th>
                            <th className="text-left px-3 py-2">Enabled</th>
                            <th className="text-left px-3 py-2">Output → score</th>
                            <th className="text-left px-3 py-2">Last status</th>
                            <th className="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400"><Loader2 className="inline animate-spin mr-2" size={16} /> Loading providers…</td></tr>}
                        {!loading && providers.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">No providers registered. Seed with <code>db:seed --class=ApiProviderSeeder</code>.</td></tr>}
                        {!loading && providers.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setOpenId(p.id); dispatch(fetchProvider(p.id)); }}>
                                <td className="px-3 py-2">
                                    <div className="font-medium text-slate-800">{p.label}</div>
                                    <div className="text-xs text-slate-400">{p.provider_key}</div>
                                </td>
                                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${CATEGORY_BADGE[p.category] || 'bg-slate-100'}`}>{p.category}</span></td>
                                <td className="px-3 py-2 text-slate-600">{p.mode}</td>
                                <td className="px-3 py-2">{p.enabled ? <span className="text-emerald-700 text-xs">Enabled</span> : <span className="text-red-600 text-xs">Disabled</span>}</td>
                                <td className="px-3 py-2 text-xs">{p.output_affects_score ? 'yes' : 'no'}</td>
                                <td className="px-3 py-2 text-xs text-slate-500">{p.last_status_code || '—'}</td>
                                <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={async () => { await dispatch(providerAction({ id: p.id, action: 'probe' })); dispatch(fetchProviders()); }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-100 hover:bg-slate-200">
                                        <PlayCircle size={12} /> Probe
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {openId && <ProviderDrawer id={openId} onClose={() => setOpenId(null)} onChanged={() => dispatch(fetchProviders())} />}
        </div>
    );
}

function ProviderDrawer({ id, onClose, onChanged }) {
    const dispatch = useDispatch();
    const detail = useSelector((s) => selectProvider(s, id));
    const acting = useSelector(selectApiControlActing);
    const [disableReason, setDisableReason] = useState('');
    const [showDisable, setShowDisable] = useState(false);

    const p = detail;

    const toggleGov = async (field, value) => {
        await dispatch(updateProvider({ id, body: { [field]: value } }));
        dispatch(fetchProvider(id));
        onChanged();
    };

    const setEnabled = async (enabled) => {
        if (enabled) {
            await dispatch(providerAction({ id, action: 'enable' }));
            dispatch(fetchProvider(id)); onChanged();
        } else {
            setShowDisable(true);
        }
    };

    return (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
            <div className="w-full max-w-lg h-full bg-white shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between">
                    <div><h2 className="text-lg font-semibold text-slate-900">{p?.label || id}</h2><p className="text-xs text-slate-400">{p?.provider_key}</p></div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
                </div>

                {!detail && <div className="p-8 text-center text-slate-400"><Loader2 className="inline animate-spin" size={18} /></div>}

                {detail && (
                    <div className="p-5 space-y-5">
                        <section className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700">Provider enabled</span>
                            <button onClick={() => setEnabled(!p.enabled)} disabled={acting}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-white ${p.enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                                <Power size={13} /> {p.enabled ? 'Disable' : 'Enable'}
                            </button>
                        </section>

                        <section className="text-xs text-slate-500 flex items-center gap-1.5">
                            <KeyRound size={12} /> Auth key: {p.has_auth_key ? <span className="text-slate-700">configured (reference only)</span> : <span className="text-amber-600">not set</span>}
                        </section>

                        <section className="space-y-2">
                            <h3 className="text-xs uppercase tracking-wide text-slate-400">Output governance</h3>
                            <Toggle label="Can write to DB"          value={p.can_write_db}                onChange={(v) => toggleGov('can_write_db', v)} />
                            <Toggle label="Output visible to customer" value={p.output_visible_to_customer} onChange={(v) => toggleGov('output_visible_to_customer', v)} />
                            <Toggle label="Output affects score"      value={p.output_affects_score}        onChange={(v) => toggleGov('output_affects_score', v)} />
                            <Toggle label="Output affects compliance" value={p.output_affects_compliance}   onChange={(v) => toggleGov('output_affects_compliance', v)} />
                            <Toggle label="Can create tickets"        value={p.output_can_create_tickets}   onChange={(v) => toggleGov('output_can_create_tickets', v)} />
                            <Toggle label="Can create takedowns"      value={p.output_can_create_takedowns} onChange={(v) => toggleGov('output_can_create_takedowns', v)} />
                        </section>

                        <section className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                            <Stat label="Timeout (ms)" value={p.timeout_ms} />
                            <Stat label="Retries" value={p.retry_count} />
                            <Stat label="Rate limit/min" value={p.rate_limit_per_min ?? '—'} />
                            <Stat label="Concurrency" value={p.concurrency} />
                            <Stat label="Monthly usage" value={p.monthly_usage_count} />
                            <Stat label="Est. cost" value={`$${p.monthly_estimated_cost ?? 0}`} />
                        </section>

                        <button onClick={async () => { await dispatch(providerAction({ id, action: 'test' })); dispatch(fetchProvider(id)); }}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-slate-100 hover:bg-slate-200 text-sm">
                            <PlayCircle size={14} /> Run test call
                        </button>
                    </div>
                )}
            </div>

            {showDisable && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowDisable(false)}>
                    <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                        <h3 className="font-semibold text-slate-900">Disable provider globally</h3>
                        <p className="text-sm text-slate-600">This is a high-risk action and will be queued for approval. Provide a reason.</p>
                        <textarea value={disableReason} onChange={(e) => setDisableReason(e.target.value)} rows={3} placeholder="Reason (required)"
                            className="w-full text-sm p-2 border border-slate-300 rounded-md" />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowDisable(false)} className="px-3 py-1.5 text-sm text-slate-700">Cancel</button>
                            <button disabled={!disableReason.trim()}
                                onClick={async () => { await dispatch(providerAction({ id, action: 'disable', body: { reason: disableReason.trim() } })); setShowDisable(false); onChanged(); }}
                                className="px-3 py-1.5 text-sm text-white rounded bg-red-600 hover:bg-red-700 disabled:opacity-50">Queue for approval</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
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

function Stat({ label, value }) {
    return <div className="bg-slate-50 rounded p-2"><div className="text-slate-400">{label}</div><div className="text-slate-800 font-medium">{value}</div></div>;
}
