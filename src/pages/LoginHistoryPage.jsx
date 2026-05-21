import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
    Clock, ShieldAlert, UserCheck, KeyRound, RefreshCcw, Building2, Filter,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchLoginHistory,
    selectLoginHistory, selectLoginHistoryMeta, selectLoginHistoryLoading,
} from '../features/admin/adminLoginHistorySlice';

/**
 * Platform-wide login history view.
 *
 *   /login-history
 *
 * Surfaces every authentication event the server recorded via the
 * LoginHistory model: password logins, impersonation starts, failed
 * OTP attempts. The same data is queryable per-user via
 * /api/admin/users/{id}/login-history — surfaced on user detail later.
 *
 * Filters mirror the backend's controller exactly so the admin can
 * narrow down without leaving the page.
 */

const METHOD_OPTIONS = [
    { value: '',              label: 'All methods' },
    { value: 'password',      label: 'Password' },
    { value: 'impersonation', label: 'Impersonation' },
    { value: '2fa',           label: '2FA' },
    { value: 'token_refresh', label: 'Token refresh' },
];

const SUCCESS_OPTIONS = [
    { value: '',      label: 'All outcomes' },
    { value: 'true',  label: 'Success only' },
    { value: 'false', label: 'Failures only' },
];

export default function LoginHistoryPage() {
    const dispatch = useDispatch();
    const list     = useSelector(selectLoginHistory);
    const meta     = useSelector(selectLoginHistoryMeta);
    const loading  = useSelector(selectLoginHistoryLoading);

    const [filters, setFilters] = useState({
        method:   '',
        success:  '',
        ip:       '',
        from:     '',
        to:       '',
        per_page: 50,
        page:     1,
    });

    useEffect(() => {
        // Build the actual query — strip empty strings so we don't send
        // them as literal "" filters (the backend's `if ($v)` checks
        // treat them as truthy strings otherwise).
        const params = Object.fromEntries(
            Object.entries(filters).filter(([, v]) => v !== '' && v != null)
        );
        dispatch(fetchLoginHistory(params));
    }, [dispatch, filters]);

    const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val, page: key === 'page' ? val : 1 }));

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                    <Clock size={22} /> Login History
                </h1>
                <p className="text-sm text-slate-600">
                    Every authentication event recorded by the platform — password logins, impersonation starts,
                    and failed OTP attempts. Filterable by method, outcome, IP, and date range.
                </p>
            </header>

            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                <div className="col-span-2 md:col-span-1">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Method</label>
                    <select value={filters.method} onChange={(e) => setFilter('method', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md">
                        {METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Outcome</label>
                    <select value={filters.success} onChange={(e) => setFilter('success', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md">
                        {SUCCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">IP contains</label>
                    <input value={filters.ip} onChange={(e) => setFilter('ip', e.target.value)}
                        placeholder="e.g. 192.168" className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md" />
                </div>
                <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">From</label>
                    <input type="datetime-local" value={filters.from} onChange={(e) => setFilter('from', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md" />
                </div>
                <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">To</label>
                    <input type="datetime-local" value={filters.to} onChange={(e) => setFilter('to', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md" />
                </div>
                <button type="button"
                    onClick={() => setFilters({ method: '', success: '', ip: '', from: '', to: '', per_page: 50, page: 1 })}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 flex items-center gap-1">
                    <Filter size={12} /> Clear
                </button>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">When</th>
                            <th className="px-3 py-2 text-left">User</th>
                            <th className="px-3 py-2 text-left">Method</th>
                            <th className="px-3 py-2 text-left">IP</th>
                            <th className="px-3 py-2 text-left">Outcome</th>
                            <th className="px-3 py-2 text-left">User agent</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !list.length ? (
                            <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">
                                Loading login history…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">
                                No login events match these filters.
                            </td></tr>
                        ) : list.map((row) => (
                            <Row key={row.id} row={row} />
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {meta && meta.last_page > 1 && (
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                    <div>
                        Showing {(meta.current_page - 1) * meta.per_page + 1}–
                        {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total.toLocaleString()}
                    </div>
                    <div className="flex gap-2">
                        <button type="button" disabled={meta.current_page <= 1}
                            onClick={() => setFilter('page', meta.current_page - 1)}
                            className="px-2 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40">
                            ‹ Previous
                        </button>
                        <span className="px-2 py-1">Page {meta.current_page} / {meta.last_page}</span>
                        <button type="button" disabled={meta.current_page >= meta.last_page}
                            onClick={() => setFilter('page', meta.current_page + 1)}
                            className="px-2 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40">
                            Next ›
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function Row({ row }) {
    const when = row.logged_in_at ? formatDistanceToNow(parseISO(row.logged_in_at), { addSuffix: true }) : '—';

    const MethodIcon = row.login_method === 'impersonation' ? UserCheck
                      : row.login_method === '2fa'          ? ShieldAlert
                      : row.login_method === 'token_refresh' ? RefreshCcw
                      : KeyRound;

    return (
        <tr className={row.success ? 'hover:bg-slate-50/50' : 'bg-red-50/30 hover:bg-red-50/50'}>
            <td className="px-3 py-2.5 text-xs text-slate-700 whitespace-nowrap" title={row.logged_in_at}>
                {when}
            </td>
            <td className="px-3 py-2.5">
                {row.user ? (
                    <div className="text-xs">
                        <div className="font-medium text-slate-900">{row.user.name}</div>
                        <div className="text-slate-500">{row.user.email}</div>
                    </div>
                ) : (
                    <span className="text-xs text-slate-400 font-mono">{row.user_id}</span>
                )}
                {row.impersonator && (
                    <div className="mt-1 text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-900 rounded border border-amber-200">
                        <UserCheck size={9} /> via {row.impersonator.email}
                    </div>
                )}
            </td>
            <td className="px-3 py-2.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 rounded">
                    <MethodIcon size={10} /> {row.login_method}
                </span>
            </td>
            <td className="px-3 py-2.5 text-xs font-mono text-slate-600">{row.ip_address || '—'}</td>
            <td className="px-3 py-2.5">
                {row.success ? (
                    <span className="text-xs font-medium text-emerald-700">Success</span>
                ) : (
                    <div>
                        <span className="text-xs font-medium text-red-700">Failed</span>
                        {row.failure_reason && (
                            <div className="text-[10px] text-red-600 mt-0.5 truncate max-w-[180px]" title={row.failure_reason}>
                                {row.failure_reason}
                            </div>
                        )}
                    </div>
                )}
            </td>
            <td className="px-3 py-2.5 text-[10px] text-slate-500 truncate max-w-[260px]" title={row.user_agent}>
                {row.user_agent || '—'}
            </td>
        </tr>
    );
}
