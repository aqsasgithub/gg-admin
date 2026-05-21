import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Download, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchAuditLog, fetchAuditActions,
    selectAuditLog, selectAuditMeta, selectAuditActions, selectAuditLoading,
} from '../features/admin/adminAuditSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';
import RoleBadge from '../components/admin/RoleBadge';
import apiRequest from '../api/client';

/**
 * Audit log reader. Every privileged action in the admin panel writes
 * a row to this stream — the page exposes filtering, search, and a
 * CSV export of the active filter set.
 */

export default function AdminAuditLog() {
    const dispatch = useDispatch();
    const list     = useSelector(selectAuditLog);
    const meta     = useSelector(selectAuditMeta);
    const actions  = useSelector(selectAuditActions);
    const loading  = useSelector(selectAuditLoading);

    const [filters,  setFilters]  = useState({});
    const [page,     setPage]     = useState(1);
    const [expanded, setExpanded] = useState({});

    useEffect(() => {
        dispatch(fetchAuditLog({ ...filters, page, per_page: 50 }));
    }, [dispatch, filters, page]);

    useEffect(() => { dispatch(fetchAuditActions()); }, [dispatch]);

    const exportCsv = async () => {
        try {
            const resp = await apiRequest.get('/admin/audit/export.csv', {
                params: filters,
                responseType: 'blob',
                showSuccessToast: false,
                showErrorToast: false,
            });
            const blob = new Blob([resp.data], { type: 'text/csv' });
            const url  = window.URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Audit export failed', e);
        }
    };

    return (
        <div className="p-6 space-y-4">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy">Audit Log</h1>
                    <p className="text-sm text-slate-600">Append-only record of every privileged action.</p>
                </div>
                <button
                    type="button"
                    onClick={exportCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 text-sm"
                >
                    <Download size={14} /> Export CSV
                </button>
            </header>

            <AdminFilterBar
                filters={[
                    { key: 'search',            type: 'text',   label: 'Search', placeholder: 'Summary, actor, target...' },
                    { key: 'action',            type: 'select', label: 'Action', options: actions.map((a) => ({ value: a, label: a })) },
                    { key: 'outcome',           type: 'select', label: 'Outcome', options: [
                        { value: 'success', label: 'success' },
                        { value: 'failure', label: 'failure' },
                    ]},
                    { key: 'since', type: 'date', label: 'Since' },
                    { key: 'until', type: 'date', label: 'Until' },
                ]}
                value={filters}
                onChange={(v) => { setFilters(v); setPage(1); }}
                onClear={() => { setFilters({}); setPage(1); }}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2"></th>
                            <th className="px-3 py-2 text-left">When</th>
                            <th className="px-3 py-2 text-left">Actor</th>
                            <th className="px-3 py-2 text-left">Action</th>
                            <th className="px-3 py-2 text-left">Summary</th>
                            <th className="px-3 py-2 text-left">Target</th>
                            <th className="px-3 py-2 text-left">Outcome</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !list.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">Loading...</td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">No audit entries match this filter.</td></tr>
                        ) : list.map((row) => (
                            <>
                                <tr key={row.id} className="hover:bg-slate-50/50">
                                    <td className="px-3 py-2">
                                        <button
                                            type="button"
                                            onClick={() => setExpanded({ ...expanded, [row.id]: !expanded[row.id] })}
                                            className="text-slate-400 hover:text-slate-700"
                                        >
                                            {expanded[row.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                                        {row.created_at ? formatDistanceToNow(parseISO(row.created_at), { addSuffix: true }) : '—'}
                                    </td>
                                    <td className="px-3 py-2">
                                        <RoleBadge role={row.actor_role} />
                                        {row.actor_user_id && (
                                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">{row.actor_user_id}</div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        <code className="px-1.5 py-0.5 text-xs bg-slate-100 rounded">{row.action}</code>
                                    </td>
                                    <td className="px-3 py-2 text-slate-800 max-w-md truncate">
                                        {row.summary ?? '—'}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-500">
                                        {row.target_type && (
                                            <div>
                                                <span className="text-slate-700">{row.target_type}</span>
                                                {row.target_id && <span className="font-mono ml-1">{row.target_id}</span>}
                                            </div>
                                        )}
                                        {row.target_company_id && (
                                            <div className="font-mono mt-0.5">@ {row.target_company_id}</div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        {row.outcome === 'failure' ? (
                                            <span className="px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-200 rounded-full">failure</span>
                                        ) : (
                                            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 rounded-full">success</span>
                                        )}
                                    </td>
                                </tr>
                                {expanded[row.id] && (
                                    <tr key={`${row.id}-detail`} className="bg-slate-50">
                                        <td colSpan="7" className="px-3 py-3">
                                            <ContextDump row={row} />
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                    </tbody>
                </table>

                {meta && meta.last_page > 1 && (
                    <Pagination meta={meta} onChange={setPage} />
                )}
            </div>
        </div>
    );
}

function ContextDump({ row }) {
    return (
        <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
                <div className="font-semibold text-slate-700 mb-1">Metadata</div>
                <dl className="space-y-0.5">
                    <Row k="id"        v={row.id} />
                    <Row k="actor IP"  v={row.ip ?? '—'} />
                    <Row k="UA"        v={row.user_agent ?? '—'} truncate />
                </dl>
            </div>
            <div>
                <div className="font-semibold text-slate-700 mb-1">Context</div>
                {row.context ? (
                    <pre className="text-[11px] bg-white border border-slate-200 rounded p-2 overflow-x-auto max-h-48 text-slate-700">
                        {JSON.stringify(row.context, null, 2)}
                    </pre>
                ) : <span className="text-slate-400">none</span>}
            </div>
        </div>
    );
}

function Row({ k, v, truncate }) {
    return (
        <div className="flex">
            <dt className="text-slate-500 mr-2 min-w-20">{k}:</dt>
            <dd className={`text-slate-800 font-mono ${truncate ? 'truncate' : ''}`}>{v}</dd>
        </div>
    );
}

function Pagination({ meta, onChange }) {
    return (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-sm">
            <div className="text-slate-600">
                Page {meta.current_page} of {meta.last_page} · {meta.total} entries
            </div>
            <div className="flex gap-1">
                <button
                    type="button"
                    disabled={meta.current_page <= 1}
                    onClick={() => onChange(meta.current_page - 1)}
                    className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40"
                >
                    Previous
                </button>
                <button
                    type="button"
                    disabled={meta.current_page >= meta.last_page}
                    onClick={() => onChange(meta.current_page + 1)}
                    className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40"
                >
                    Next
                </button>
            </div>
        </div>
    );
}
