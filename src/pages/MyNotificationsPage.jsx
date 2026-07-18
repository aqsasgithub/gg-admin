import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Bell, CheckCheck, ShieldAlert, Radar, FileText, Plug, User, Building2, Server,
} from 'lucide-react';
import {
    fetchMyNotifications,
    fetchMyUnreadCount,
    markMyNotificationRead,
    markAllMyNotificationsRead,
    selectMyNotifications,
    selectMyUnreadCount,
    selectMyNotificationsLoading,
    selectMyNotificationsMeta,
} from '../features/admin/meNotificationsSlice';

const CATEGORY_ICON = {
    security: ShieldAlert, scan: Radar, report: FileText, integration: Plug,
    user: User, company: Building2, system: Server, admin: Server,
};
const iconFor = (c) => CATEGORY_ICON[c] || Bell;

const SEVERITY = {
    critical: { text: 'text-red-600',     ring: 'bg-red-50',     dot: 'bg-red-500' },
    warning:  { text: 'text-amber-600',   ring: 'bg-amber-50',   dot: 'bg-amber-500' },
    success:  { text: 'text-emerald-600', ring: 'bg-emerald-50', dot: 'bg-emerald-500' },
    info:     { text: 'text-slate-600',   ring: 'bg-slate-100',  dot: 'bg-slate-400' },
};
const accentFor = (s) => SEVERITY[s] || SEVERITY.info;

const relTime = (iso) => {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '';
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 45) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
};

const CATEGORIES = [
    { key: '',        label: 'All' },
    { key: 'admin',   label: 'Administrative' },
    { key: 'system',  label: 'System' },
    { key: 'security',label: 'Security' },
];

/**
 * Operator ("my") notification history for the admin portal. Reads
 * /admin/me/notifications (audience='admin' rows only) — this is the operator's
 * own bell history, NOT the cross-tenant delivery log (that lives at
 * /notifications → NotificationLogPage).
 */
export default function MyNotificationsPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const items = useSelector(selectMyNotifications);
    const unread = useSelector(selectMyUnreadCount);
    const loading = useSelector(selectMyNotificationsLoading);
    const meta = useSelector(selectMyNotificationsMeta);

    const [category, setCategory] = useState('');
    const [unreadOnly, setUnreadOnly] = useState(false);

    const load = useCallback((page = 1) => {
        dispatch(fetchMyNotifications({ page, perPage: 20, category: category || undefined, unread: unreadOnly || undefined }));
    }, [dispatch, category, unreadOnly]);

    useEffect(() => { load(1); }, [load]);
    useEffect(() => { dispatch(fetchMyUnreadCount()); }, [dispatch]);

    const onItemClick = (n) => {
        if (!n.read) dispatch(markMyNotificationRead(n.id));
        if (n.action_url) navigate(n.action_url);
    };

    const canLoadMore = meta && meta.current_page < meta.last_page;

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Bell size={20} className="text-guardian-navy" />
                    <h1 className="text-lg font-semibold text-slate-900">My notifications</h1>
                    {unread > 0 && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500 text-white">{unread} unread</span>
                    )}
                </div>
                {unread > 0 && (
                    <button
                        type="button"
                        onClick={() => dispatch(markAllMyNotificationsRead())}
                        className="text-sm text-guardian-navy hover:underline flex items-center gap-1.5"
                    >
                        <CheckCheck size={15} /> Mark all read
                    </button>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-5">
                {CATEGORIES.map((c) => (
                    <button
                        key={c.key || 'all'}
                        type="button"
                        onClick={() => setCategory(c.key)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border ${
                            category === c.key
                                ? 'bg-guardian-navy text-white border-guardian-navy'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        {c.label}
                    </button>
                ))}
                <label className="ml-auto flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={unreadOnly}
                        onChange={(e) => setUnreadOnly(e.target.checked)}
                        className="rounded border-slate-300 text-guardian-navy focus:ring-guardian-navy"
                    />
                    Unread only
                </label>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {loading && items.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">Loading…</div>
                ) : items.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <Bell size={26} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm">No notifications to show</p>
                    </div>
                ) : (
                    items.map((n) => {
                        const Icon = iconFor(n.category);
                        const a = accentFor(n.severity);
                        return (
                            <button
                                type="button"
                                key={n.id}
                                onClick={() => onItemClick(n)}
                                className={`w-full text-left p-4 hover:bg-slate-50 flex items-start gap-3 ${!n.read ? 'bg-slate-50/70' : ''}`}
                            >
                                <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${a.ring}`}>
                                    <Icon size={16} className={a.text} />
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-900">{n.title}</span>
                                        {!n.read && <span className={`shrink-0 w-2 h-2 rounded-full ${a.dot}`} />}
                                    </span>
                                    {n.body && <span className="block text-xs text-slate-500 mt-0.5">{n.body}</span>}
                                    <span className="block text-[11px] text-slate-400 mt-1">{relTime(n.created_at)}</span>
                                </span>
                            </button>
                        );
                    })
                )}
            </div>

            {canLoadMore && (
                <div className="mt-4 text-center">
                    <button
                        type="button"
                        disabled={loading}
                        onClick={() => load(meta.current_page + 1)}
                        className="px-4 py-2 text-sm text-guardian-navy border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                    >
                        {loading ? 'Loading…' : 'Load more'}
                    </button>
                </div>
            )}
        </div>
    );
}
