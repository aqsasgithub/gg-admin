import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Power, Loader2, Play, RotateCcw, Repeat, RefreshCw, XCircle, Archive } from 'lucide-react';
import {
    fetchScanControl, runScan, scanControlAction,
    selectScanControlList, selectScanControlMeta, selectScanControlLoading, selectScanControlActing,
} from '../features/admin/adminScanControlOpsSlice';
import { selectAdminCapabilities } from '../features/auth/authSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';

export default function ScanControlPage() {
    const dispatch = useDispatch();
    const list    = useSelector(selectScanControlList);
    const meta    = useSelector(selectScanControlMeta);
    const loading = useSelector(selectScanControlLoading);
    const acting  = useSelector(selectScanControlActing);
    const caps    = useSelector(selectAdminCapabilities);
    const can = (c) => caps.includes('*') || caps.includes(c);
    const canRun = can('scans.run');
    const canArchive = can('scans.archive');

    const [filters, setFilters] = useState({});
    const [showRun, setShowRun] = useState(false);
    const [archiveFor, setArchiveFor] = useState(null);

    const reload = () => dispatch(fetchScanControl(filters));
    useEffect(() => { reload(); }, [dispatch, JSON.stringify(filters)]);

    const act = async (scanId, action, body = {}) => { await dispatch(scanControlAction({ scanId, action, body })); reload(); };

    return (
        <div className="p-6 space-y-4">
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2"><Power size={22} /> Scan Control</h1>
                    <p className="text-sm text-slate-600 max-w-3xl">Trigger, retry, replay, reprocess, cancel and archive scans. Runs dispatch to the real scan pipeline; archive is routed to the approval queue.</p>
                </div>
                {canRun && <button onClick={() => setShowRun(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-guardian-navy text-white text-sm hover:bg-guardian-navy-800"><Play size={14} /> Run scan</button>}
            </header>

            <AdminFilterBar
                filters={[
                    { key: 'company_id', type: 'text', label: 'Company', placeholder: 'cmp_…' },
                    { key: 'status', type: 'text', label: 'Status', placeholder: 'queued / running…' },
                    { key: 'scan_type', type: 'text', label: 'Scan type' },
                ]}
                value={filters} onChange={setFilters} onClear={() => setFilters({})}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                        <tr>
                            <th className="text-left px-3 py-2">Scan</th>
                            <th className="text-left px-3 py-2">Type</th>
                            <th className="text-left px-3 py-2">Status</th>
                            <th className="text-right px-3 py-2">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400"><Loader2 className="inline animate-spin mr-2" size={16} /> Loading…</td></tr>}
                        {!loading && list.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">No scans.</td></tr>}
                        {!loading && list.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2"><div className="font-medium text-slate-800">{s.id}</div><div className="text-xs text-slate-400">{s.company_id}</div></td>
                                <td className="px-3 py-2 text-slate-600">{s.scan_type}</td>
                                <td className="px-3 py-2 text-slate-600">{s.status}</td>
                                <td className="px-3 py-2 text-right">
                                    <div className="inline-flex gap-1 flex-wrap justify-end">
                                        {canRun && <>
                                            <ActBtn icon={XCircle} label="Cancel" onClick={() => act(s.id, 'cancel')} disabled={acting} />
                                            <ActBtn icon={RotateCcw} label="Retry" onClick={() => act(s.id, 'retry')} disabled={acting} />
                                            <ActBtn icon={Repeat} label="Replay" onClick={() => act(s.id, 'replay')} disabled={acting} />
                                            <ActBtn icon={RefreshCw} label="Reprocess" onClick={() => act(s.id, 'reprocess')} disabled={acting} />
                                        </>}
                                        {canArchive && <ActBtn icon={Archive} label="Archive" red onClick={() => setArchiveFor(s.id)} disabled={acting} />}
                                        {!canRun && !canArchive && <span className="text-xs text-slate-400">View only</span>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {meta && <div className="text-xs text-slate-500">{meta.total} scans</div>}

            {showRun && canRun && <RunScanModal onClose={() => setShowRun(false)} onRan={() => { setShowRun(false); reload(); }} />}
            {archiveFor && canArchive && (
                <ReasonModal title="Archive scan (needs approval)" onCancel={() => setArchiveFor(null)}
                    onConfirm={async (reason) => { await act(archiveFor, 'archive', { reason }); setArchiveFor(null); }} />
            )}
        </div>
    );
}

function ActBtn({ icon: Icon, label, onClick, disabled, red }) {
    const cls = red ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200';
    return <button onClick={onClick} disabled={disabled} title={label} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${cls} disabled:opacity-50`}><Icon size={12} /> {label}</button>;
}

function RunScanModal({ onClose, onRan }) {
    const dispatch = useDispatch();
    const [form, setForm] = useState({
        company_id: '', scan_type: '', domain_id: '', module: '',
        api_provider: '', priority: 5, mode: 'active',
    });
    const [busy, setBusy] = useState(false);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const submit = async () => {
        setBusy(true);
        try {
            await dispatch(runScan({
                company_id:   form.company_id,
                scan_type:    form.scan_type,
                domain_id:    form.domain_id || undefined,
                module:       form.module || undefined,
                api_provider: form.api_provider || undefined,
                priority:     Number(form.priority) || undefined,
                mode:         form.mode || undefined,
            }));
            onRan();
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-semibold text-slate-900">Run scan</h3>
                <label className="block text-sm">Company ID *<input value={form.company_id} onChange={set('company_id')} placeholder="cmp_…" className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" /></label>
                <label className="block text-sm">Scan type *<input value={form.scan_type} onChange={set('scan_type')} placeholder="network_security / cloud_security…" className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" /></label>
                <div className="grid grid-cols-2 gap-2">
                    <label className="block text-sm">Domain ID<input value={form.domain_id} onChange={set('domain_id')} placeholder="dmn_… (module scans)" className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" /></label>
                    <label className="block text-sm">Module<input value={form.module} onChange={set('module')} placeholder="defaults to scan type" className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" /></label>
                </div>
                <label className="block text-sm">API provider<input value={form.api_provider} onChange={set('api_provider')} placeholder="aws / gcp / azure (provider scans)" className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" /></label>
                <div className="grid grid-cols-2 gap-2">
                    <label className="block text-sm">Priority
                        <select value={form.priority} onChange={set('priority')} className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm">
                            {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n}{n === 1 ? ' (highest)' : n === 10 ? ' (lowest)' : ''}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm">Mode
                        <select value={form.mode} onChange={set('mode')} className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm">
                            <option value="active">Active</option>
                            <option value="passive">Passive</option>
                        </select>
                    </label>
                </div>
                <p className="text-xs text-slate-400">Module scans need a Domain ID + Module. Provider scans need an API provider with a configured connection.</p>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-700">Cancel</button>
                    <button disabled={!form.company_id || !form.scan_type || busy} onClick={submit}
                        className="px-3 py-1.5 text-sm text-white rounded bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50">Run</button>
                </div>
            </div>
        </div>
    );
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
                        className="px-3 py-1.5 text-sm text-white rounded bg-red-600 hover:bg-red-700 disabled:opacity-50">Confirm</button>
                </div>
            </div>
        </div>
    );
}
