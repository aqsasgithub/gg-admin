import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Play, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import {
    runAdminAssessment, runAdminModule, runAdminBulkAssessment,
    selectAdminAssessmentProgress, selectAdminBulkRunning,
    ADMIN_ASSESSMENT_MODULES,
} from '../../features/admin/adminAssessmentSlice';

/**
 * AdminAssessmentRunner — drops into a company's Domains tab.
 *
 * Calls /admin/orchestrator/run-multi per domain (and /admin/orchestrator/
 * run for per-module retry), then PATCH /admin/domains/{id}/scanned —
 * the same sequence the customer Assessment page executes against
 * /api/orchestrator/* + /api/domain/{id}/scanned. Because the backend
 * delegates to the SAME ModuleOrchestratorService, post-run DB state
 * is identical to a customer-initiated assessment.
 *
 * Two modes selected by the `domains` prop length:
 *   - 1 domain: shows the per-module status row + Run button
 *   - N domains: shows a per-domain checkbox list + Run on selected button
 */
export default function AdminAssessmentRunner({ companyId, domains }) {
    const dispatch = useDispatch();
    const bulkRunning = useSelector(selectAdminBulkRunning);

    const [selected, setSelected] = useState(() => new Set());

    const unscanned = useMemo(
        () => domains.filter((d) => d.scanned_at == null),
        [domains],
    );

    const toggle = (id) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const selectAllUnscanned = () => setSelected(new Set(unscanned.map((d) => d.id)));
    const clearSelection     = () => setSelected(new Set());

    const runBulk = () => {
        const ids = [...selected];
        if (ids.length === 0) return;
        dispatch(runAdminBulkAssessment({ companyId, domainIds: ids }));
    };

    return (
        <div className="bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div>
                    <h3 className="text-base font-semibold text-slate-900">Run Assessment</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Identical to the customer Assessment flow — all six modules execute via the
                        same orchestrator and persist to the same tables.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={selectAllUnscanned}
                        disabled={bulkRunning || unscanned.length === 0}
                        className="text-xs text-guardian-navy hover:underline disabled:opacity-40"
                    >
                        Select all unscanned ({unscanned.length})
                    </button>
                    <button
                        type="button"
                        onClick={clearSelection}
                        disabled={bulkRunning || selected.size === 0}
                        className="text-xs text-slate-500 hover:underline disabled:opacity-40"
                    >
                        Clear
                    </button>
                    <button
                        type="button"
                        onClick={runBulk}
                        disabled={bulkRunning || selected.size === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-guardian-navy hover:bg-guardian-navy-800 text-white text-sm font-medium rounded-md disabled:opacity-50"
                    >
                        {bulkRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        Run on selected ({selected.size})
                    </button>
                </div>
            </div>

            <div className="divide-y divide-slate-100">
                {domains.length === 0 && (
                    <div className="p-6 text-center text-sm text-slate-500">
                        Add at least one domain to run an assessment.
                    </div>
                )}
                {domains.map((d) => (
                    <DomainRunnerRow
                        key={d.id}
                        companyId={companyId}
                        domain={d}
                        checked={selected.has(d.id)}
                        onToggle={() => toggle(d.id)}
                        bulkRunning={bulkRunning}
                    />
                ))}
            </div>
        </div>
    );
}

function DomainRunnerRow({ companyId, domain, checked, onToggle, bulkRunning }) {
    const dispatch = useDispatch();
    const progress = useSelector((s) => selectAdminAssessmentProgress(s, domain.id));
    const status   = progress?.status ?? 'pending';

    const runOne = () => {
        dispatch(runAdminAssessment({ companyId, domainId: domain.id }));
    };
    const retry = (moduleName) => {
        dispatch(runAdminModule({ companyId, domainId: domain.id, moduleName }));
    };

    return (
        <div className="p-4">
            <div className="flex items-center gap-3">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={onToggle}
                    disabled={bulkRunning}
                    className="h-4 w-4 accent-guardian-navy"
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-slate-800 truncate">{domain.domain}</span>
                        {domain.is_primary && (
                            <span className="px-1.5 py-0.5 bg-guardian-navy/5 text-guardian-navy text-[10px] font-medium rounded">
                                primary
                            </span>
                        )}
                        {domain.scanned_at && (
                            <span className="text-[10px] text-slate-400">
                                last scanned {new Date(domain.scanned_at).toLocaleString()}
                            </span>
                        )}
                    </div>
                </div>
                <StatusPill status={status} />
                <button
                    type="button"
                    onClick={runOne}
                    disabled={status === 'running' || bulkRunning}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-slate-300 hover:bg-slate-50 rounded-md disabled:opacity-50"
                >
                    {status === 'running'
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Play className="w-3 h-3" />}
                    {status === 'running' ? 'Running' : 'Run'}
                </button>
            </div>

            {progress && (
                <div className="mt-3 ml-7 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {ADMIN_ASSESSMENT_MODULES.map((m) => {
                        const mod = progress.modules?.[m.name];
                        return (
                            <ModulePill
                                key={m.name}
                                label={m.label}
                                status={mod?.status ?? 'pending'}
                                degraded={!!mod?.degraded}
                                onRetry={() => retry(m.name)}
                                running={status === 'running'}
                            />
                        );
                    })}
                </div>
            )}

            {progress?.error && (
                <div className="mt-2 ml-7 text-xs text-red-700">
                    {progress.error}
                </div>
            )}
        </div>
    );
}

function StatusPill({ status }) {
    const map = {
        pending: { cls: 'bg-slate-100 text-slate-500',          label: 'Pending' },
        running: { cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200', label: 'Running' },
        success: { cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', label: 'Complete' },
        failed:  { cls: 'bg-red-50 text-red-700 ring-1 ring-red-200', label: 'Has failures' },
    };
    const x = map[status] ?? map.pending;
    return (
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${x.cls}`}>
            {x.label}
        </span>
    );
}

function ModulePill({ label, status, degraded, onRetry, running }) {
    const icon = status === 'success' ? <CheckCircle className="w-3 h-3 text-emerald-600" />
              : status === 'failed'  ? <AlertCircle className="w-3 h-3 text-red-600" />
              : status === 'running' ? <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
              : status === 'skipped' ? <span className="text-[10px] text-slate-400">—</span>
              : <span className="w-2 h-2 rounded-full bg-slate-300" />;
    return (
        <div className="flex items-center gap-2 px-2 py-1 border border-slate-200 rounded-md bg-slate-50">
            <div className="w-4 flex justify-center">{icon}</div>
            <span className="text-[11px] text-slate-700 truncate flex-1">{label}</span>
            {degraded && <span className="text-[10px] text-amber-600 font-medium" title="Mock fallback">degraded</span>}
            {status === 'failed' && !running && (
                <button type="button" onClick={onRetry} title="Retry module"
                    className="text-slate-500 hover:text-guardian-navy">
                    <RefreshCw className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}
