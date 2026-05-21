import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Megaphone, Plus, Edit2, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchAnnouncements, createAnnouncement, updateAnnouncement,
    publishAnnouncement, unpublishAnnouncement, deleteAnnouncement,
    selectAnnouncements, selectAnnouncementsLoading,
} from '../features/admin/adminAnnouncementsSlice';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';

const SEVERITY_OPTIONS = [
    { value: 'info',     label: 'Info' },
    { value: 'warning',  label: 'Warning' },
    { value: 'critical', label: 'Critical' },
];

export default function AnnouncementsPage() {
    const dispatch = useDispatch();
    const list    = useSelector(selectAnnouncements);
    const loading = useSelector(selectAnnouncementsLoading);

    const [editing,    setEditing]    = useState(null);
    const [confirmDel, setConfirmDel] = useState(null);

    useEffect(() => { dispatch(fetchAnnouncements()); }, [dispatch]);

    return (
        <div className="p-6 space-y-4">
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy">Announcements</h1>
                    <p className="text-sm text-slate-600">
                        Platform-wide and per-tenant banners surfaced inside the customer app.
                    </p>
                </div>
                <button type="button" onClick={() => setEditing({})}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-guardian-navy hover:bg-guardian-navy-800 text-white text-sm font-medium rounded-md">
                    <Plus size={14} /> New announcement
                </button>
            </header>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Title</th>
                            <th className="px-3 py-2 text-left">Severity</th>
                            <th className="px-3 py-2 text-left">Scope</th>
                            <th className="px-3 py-2 text-left">Window</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !list.length ? (
                            <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">No announcements.</td></tr>
                        ) : list.map((a) => {
                            const isLive = a.published_at && new Date(a.starts_at) <= new Date() &&
                                (!a.ends_at || new Date(a.ends_at) > new Date());
                            return (
                                <tr key={a.id}>
                                    <td className="px-3 py-2.5">
                                        <div className="text-slate-900">{a.title}</div>
                                        <div className="text-xs text-slate-500 truncate max-w-md">{a.body}</div>
                                    </td>
                                    <td className="px-3 py-2.5"><SeverityPill severity={a.severity} /></td>
                                    <td className="px-3 py-2.5 text-xs">
                                        {a.company_id ? <code className="font-mono">{a.company_id}</code> : <span className="text-slate-500">Platform-wide</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-xs text-slate-500">
                                        {a.starts_at ? format(parseISO(a.starts_at), 'MMM d') : '—'}
                                        {a.ends_at ? ` → ${format(parseISO(a.ends_at), 'MMM d')}` : ' →'}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        {isLive ? <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700">Live</span> :
                                         a.published_at ? <span className="px-2 py-0.5 text-xs rounded-full bg-sky-100 text-sky-700">Scheduled</span> :
                                         <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">Draft</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <div className="flex justify-end gap-1">
                                            {a.published_at ? (
                                                <button type="button" onClick={() => dispatch(unpublishAnnouncement(a.id))}
                                                    className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="Unpublish">
                                                    <EyeOff size={12} />
                                                </button>
                                            ) : (
                                                <button type="button" onClick={() => dispatch(publishAnnouncement(a.id))}
                                                    className="p-1.5 rounded hover:bg-emerald-50 text-emerald-700" title="Publish">
                                                    <Eye size={12} />
                                                </button>
                                            )}
                                            <button type="button" onClick={() => setEditing(a)}
                                                className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="Edit">
                                                <Edit2 size={12} />
                                            </button>
                                            <button type="button" onClick={() => setConfirmDel(a)}
                                                className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Delete">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {editing && (
                <EditModal ann={editing}
                    onClose={() => setEditing(null)}
                    onSubmit={async (payload) => {
                        if (editing.id) await dispatch(updateAnnouncement({ id: editing.id, payload }));
                        else            await dispatch(createAnnouncement(payload));
                        setEditing(null);
                    }} />
            )}

            <AdminConfirmModal open={!!confirmDel}
                title={`Delete announcement "${confirmDel?.title}"?`}
                confirmLabel="Delete" variant="destructive"
                onCancel={() => setConfirmDel(null)}
                onConfirm={async () => { await dispatch(deleteAnnouncement(confirmDel.id)); setConfirmDel(null); }} />
        </div>
    );
}

function SeverityPill({ severity }) {
    const map = {
        info:     'bg-sky-100 text-sky-700',
        warning:  'bg-amber-100 text-amber-800',
        critical: 'bg-red-100 text-red-800',
    };
    return <span className={`px-2 py-0.5 text-xs rounded uppercase ${map[severity] ?? map.info}`}>{severity}</span>;
}

function EditModal({ ann, onClose, onSubmit }) {
    const isNew = !ann.id;
    const [severity, setSeverity] = useState(ann.severity ?? 'info');
    const [title,    setTitle]    = useState(ann.title ?? '');
    const [body,     setBody]     = useState(ann.body ?? '');
    const [startsAt, setStartsAt] = useState(ann.starts_at ?? new Date().toISOString().slice(0, 16));
    const [endsAt,   setEndsAt]   = useState(ann.ends_at ?? '');
    const [companyId,setCompanyId]= useState(ann.company_id ?? '');
    const [dismissible, setDismissible] = useState(ann.dismissible ?? true);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setBusy(true);
        try {
            const payload = {
                severity, title, body,
                starts_at: startsAt,
                ends_at: endsAt || null,
                company_id: companyId || null,
                dismissible,
            };
            await onSubmit(payload);
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg bg-white rounded-lg shadow-xl">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold">{isNew ? 'New announcement' : 'Edit announcement'}</h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Severity</label>
                            <select value={severity} onChange={(e) => setSeverity(e.target.value)}
                                className="w-full p-2 text-sm border border-slate-300 rounded-md">
                                {SEVERITY_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Dismissible</label>
                            <select value={dismissible ? '1' : '0'} onChange={(e) => setDismissible(e.target.value === '1')}
                                className="w-full p-2 text-sm border border-slate-300 rounded-md">
                                <option value="1">Yes</option>
                                <option value="0">No (forced)</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Title</label>
                        <input value={title} onChange={(e) => setTitle(e.target.value)}
                            className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Body</label>
                        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4}
                            className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Starts at</label>
                            <input type="datetime-local" value={startsAt?.slice(0, 16)} onChange={(e) => setStartsAt(e.target.value)}
                                className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Ends at (optional)</label>
                            <input type="datetime-local" value={endsAt?.slice(0, 16) ?? ''} onChange={(e) => setEndsAt(e.target.value)}
                                className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Scope</label>
                        <input value={companyId} onChange={(e) => setCompanyId(e.target.value)}
                            placeholder="Leave empty for platform-wide, or cmp_..."
                            className="w-full p-2 text-sm font-mono border border-slate-300 rounded-md" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm">Cancel</button>
                        <button type="button" onClick={submit} disabled={busy || !title || !body}
                            className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50 text-white rounded-md">
                            {busy ? 'Saving…' : (isNew ? 'Create as draft' : 'Save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
