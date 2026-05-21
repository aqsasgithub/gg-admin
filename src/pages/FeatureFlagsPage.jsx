import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Flag, Loader2, Plus, Trash2, Edit2 } from 'lucide-react';
import {
    fetchFlags, createFlag, updateFlag, deleteFlag,
    selectFlags, selectFlagsLoading,
} from '../features/admin/adminFlagsSlice';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';

const ENV_OPTIONS = ['all', 'production', 'staging', 'dev'];

export default function FeatureFlagsPage() {
    const dispatch = useDispatch();
    const flags   = useSelector(selectFlags);
    const loading = useSelector(selectFlagsLoading);
    const [editing, setEditing]   = useState(null);     // flag object or {} for new
    const [confirm, setConfirm]   = useState(null);

    useEffect(() => { dispatch(fetchFlags()); }, [dispatch]);

    return (
        <div className="p-6 space-y-4">
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy">Feature flags</h1>
                    <p className="text-sm text-slate-600">
                        Platform-wide flags with per-tenant overrides. Manage per-company overrides
                        from a Company's Flags tab.
                    </p>
                </div>
                <button type="button" onClick={() => setEditing({})}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-guardian-navy hover:bg-guardian-navy-800 text-white text-sm font-medium rounded-md">
                    <Plus size={14} /> New flag
                </button>
            </header>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Key</th>
                            <th className="px-3 py-2 text-left">Label</th>
                            <th className="px-3 py-2 text-left">Default</th>
                            <th className="px-3 py-2 text-left">Rollout</th>
                            <th className="px-3 py-2 text-left">Env</th>
                            <th className="px-3 py-2 text-left">Overrides</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !flags.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !flags.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">No flags defined yet.</td></tr>
                        ) : flags.map((f) => (
                            <tr key={f.id}>
                                <td className="px-3 py-2.5 font-mono text-xs">{f.key}</td>
                                <td className="px-3 py-2.5">
                                    <div className="text-slate-900">{f.label}</div>
                                    {f.description && <div className="text-xs text-slate-500 truncate max-w-md">{f.description}</div>}
                                </td>
                                <td className="px-3 py-2.5">
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${f.enabled_default ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {f.enabled_default ? 'on' : 'off'}
                                    </span>
                                </td>
                                <td className="px-3 py-2.5 text-xs">{f.rollout_percentage}%</td>
                                <td className="px-3 py-2.5 text-xs text-slate-600">{f.environment}</td>
                                <td className="px-3 py-2.5 text-xs text-slate-600">{f.override_count}</td>
                                <td className="px-3 py-2.5 text-right">
                                    <div className="flex justify-end gap-1">
                                        <button type="button" onClick={() => setEditing(f)}
                                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="Edit">
                                            <Edit2 size={12} />
                                        </button>
                                        <button type="button" onClick={() => setConfirm({ flag: f })}
                                            className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Delete">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editing && (
                <FlagEditModal flag={editing}
                    onClose={() => setEditing(null)}
                    onSubmit={async (payload) => {
                        if (editing.id) {
                            await dispatch(updateFlag({ flagId: editing.id, payload }));
                        } else {
                            await dispatch(createFlag(payload));
                        }
                        setEditing(null);
                    }} />
            )}

            <AdminConfirmModal open={!!confirm}
                title={`Delete flag ${confirm?.flag?.key}?`}
                description="All per-tenant overrides for this flag are also removed."
                confirmLabel="Delete flag" variant="destructive"
                onCancel={() => setConfirm(null)}
                onConfirm={async () => {
                    await dispatch(deleteFlag(confirm.flag.id));
                    setConfirm(null);
                }} />
        </div>
    );
}

function FlagEditModal({ flag, onClose, onSubmit }) {
    const isNew = !flag.id;
    const [key,     setKey]     = useState(flag.key ?? '');
    const [label,   setLabel]   = useState(flag.label ?? '');
    const [desc,    setDesc]    = useState(flag.description ?? '');
    const [defOn,   setDefOn]   = useState(flag.enabled_default ?? false);
    const [rollout, setRollout] = useState(flag.rollout_percentage ?? 0);
    const [env,     setEnv]     = useState(flag.environment ?? 'all');
    const [busy,    setBusy]    = useState(false);

    const submit = async () => {
        setBusy(true);
        try {
            const payload = { label, description: desc, enabled_default: defOn, rollout_percentage: Number(rollout), environment: env };
            if (isNew) payload.key = key;
            await onSubmit(payload);
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg mx-4 bg-white rounded-lg shadow-xl">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold">{isNew ? 'New feature flag' : 'Edit flag'}</h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="p-5 space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Key {isNew && '*'}</label>
                        <input value={key} onChange={(e) => setKey(e.target.value)} readOnly={!isNew}
                            placeholder="e.g. scans.network.v2"
                            className="w-full p-2 text-sm font-mono border border-slate-300 rounded-md disabled:bg-slate-50" />
                        <p className="text-xs text-slate-500 mt-1">Lowercase, dot-namespaced. Cannot be changed after creation.</p>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Label</label>
                        <input value={label} onChange={(e) => setLabel(e.target.value)}
                            className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
                            className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Default enabled</label>
                            <select value={defOn ? '1' : '0'} onChange={(e) => setDefOn(e.target.value === '1')}
                                className="w-full p-2 text-sm border border-slate-300 rounded-md">
                                <option value="0">No</option>
                                <option value="1">Yes</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Rollout %</label>
                            <input type="number" min="0" max="100" value={rollout} onChange={(e) => setRollout(e.target.value)}
                                className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Environment</label>
                        <select value={env} onChange={(e) => setEnv(e.target.value)}
                            className="w-full p-2 text-sm border border-slate-300 rounded-md">
                            {ENV_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm">Cancel</button>
                        <button type="button" onClick={submit} disabled={busy || !label || (isNew && !key)}
                            className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50 text-white rounded-md">
                            {busy ? 'Saving…' : isNew ? 'Create flag' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
