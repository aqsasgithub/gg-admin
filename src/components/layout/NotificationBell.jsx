import { useState, useEffect, useCallback } from 'react';
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
} from '../../features/admin/meNotificationsSlice';

const UNREAD_POLL_MS = 60_000;

const CATEGORY_ICON = {
    security: ShieldAlert, scan: Radar, report: FileText, integration: Plug,
    user: User, company: Building2, system: Server, admin: Server,
};
const iconFor = (c) => CATEGORY_ICON[c] || Bell;

const SEVERITY = {
    critical: { text: 'text-red-600',    ring: 'bg-red-50',    dot: 'bg-red-500' },
    warning:  { text: 'text-amber-600',  ring: 'bg-amber-50',  dot: 'bg-amber-500' },
    success:  { text: 'text-emerald-600',ring: 'bg-emerald-50',dot: 'bg-emerald-500' },
    info:     { text: 'text-slate-600',  ring: 'bg-slate-100', dot: 'bg-slate-400' },
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

/**
 * Operator bell for the admin TopBar. Reads /admin/me/notifications (admin
 * audience only). Badge poll + lazy list, mirroring the client bell.
 */
export default function NotificationBell() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const items = useSelector(selectMyNotifications);
    const unread = useSelector(selectMyUnreadCount);
    const loading = useSelector(selectMyNotificationsLoading);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        dispatch(fetchMyUnreadCount());
        const id = setInterval(() => dispatch(fetchMyUnreadCount()), UNREAD_POLL_MS);
        return () => clearInterval(id);
    }, [dispatch]);

    const openPanel = useCallback(() => {
        setOpen(true);
        dispatch(fetchMyNotifications({ page: 1, perPage: 10 }));
    }, [dispatch]);

    const onItemClick = (n) => {
        if (!n.read) dispatch(markMyNotificationRead(n.id));
        setOpen(false);
        if (n.action_url) navigate(n.action_url);
    };

    const preview = items.slice(0, 10);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => (open ? setOpen(false) : openPanel())}
                className="relative p-2 rounded hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-guardian-navy"
                aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
                aria-haspopup="true"
                aria-expanded={open}
            >
                <Bell size={18} className="text-slate-600" />
                {unread > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[1rem] h-4 px-1 bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden="true" />
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border border-slate-200 z-30 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-900">Notifications</span>
                            {unread > 0 && (
                                <button
                                    type="button"
                                    onClick={() => dispatch(markAllMyNotificationsRead())}
                                    className="text-xs text-guardian-navy hover:underline flex items-center gap-1"
                                >
                                    <CheckCheck size={13} /> Mark all read
                                </button>
                            )}
                        </div>

                        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                            {loading && preview.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
                            ) : preview.length === 0 ? (
                                <div className="p-8 text-center text-slate-400">
                                    <Bell size={22} className="mx-auto mb-2 opacity-40" />
                                    <p className="text-sm">Nothing needs your attention</p>
                                </div>
                            ) : (
                                preview.map((n) => {
                                    const Icon = iconFor(n.category);
                                    const a = accentFor(n.severity);
                                    return (
                                        <button
                                            type="button"
                                            key={n.id}
                                            onClick={() => onItemClick(n)}
                                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 flex items-start gap-3 ${!n.read ? 'bg-slate-50/70' : ''}`}
                                        >
                                            <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${a.ring}`}>
                                                <Icon size={15} className={a.text} />
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-slate-900 truncate">{n.title}</span>
                                                    {!n.read && <span className={`shrink-0 w-2 h-2 rounded-full ${a.dot}`} />}
                                                </span>
                                                {n.body && <span className="block text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</span>}
                                                <span className="block text-[11px] text-slate-400 mt-1">{relTime(n.created_at)}</span>
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <div className="p-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => { setOpen(false); navigate('/me/notifications'); }}
                                className="w-full py-2 text-sm text-guardian-navy hover:bg-slate-50 rounded"
                            >
                                View all notifications
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
