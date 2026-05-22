import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Gauge, Loader2, Play, Send, RotateCcw } from 'lucide-react';
import {
    previewScore, publishScore, rollbackScore, fetchScoreHistory, clearScoringPreview,
    selectScorePreview, selectScoreHistory, selectScoringActing, selectScoringResult, selectScoringError,
} from '../features/admin/adminScoringSlice';

export default function ScoringControlPage() {
    const dispatch = useDispatch();
    const preview = useSelector(selectScorePreview);
    const history = useSelector(selectScoreHistory);
    const acting  = useSelector(selectScoringActing);
    const result  = useSelector(selectScoringResult);
    const error   = useSelector(selectScoringError);

    const [targetType, setTargetType] = useState('company');
    const [targetId, setTargetId] = useState('');
    const [module, setModule] = useState('');
    const [reason, setReason] = useState('');

    const doPreview = () => {
        dispatch(clearScoringPreview());
        dispatch(previewScore({ target_type: targetType, target_id: targetId, company_id: targetType === 'company' ? targetId : undefined, module: module || undefined, reason: reason || undefined }));
    };
    const doPublish = () => preview?.id && dispatch(publishScore({ snapshot_id: preview.id, reason: reason || undefined }));
    const doRollback = () => dispatch(rollbackScore({ target_type: targetType, target_id: targetId }));
    const loadHistory = () => targetId && dispatch(fetchScoreHistory({ targetType, id: targetId }));

    const delta = preview ? (preview.score_after - (preview.score_before ?? preview.score_after)) : 0;
    const queued = result?.status === 202;

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                    <Gauge size={22} /> Scoring Control
                </h1>
                <p className="text-sm text-slate-600 max-w-3xl">
                    Recalculate a company / domain / module risk score from the current governed-finding state, preview the
                    before→after diff, then publish or roll back. Suppressed and excluded findings don't count. Major changes
                    (≥10 points) are routed to the approval queue.
                </p>
            </header>

            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <label className="block">
                        <span className="text-xs text-slate-500">Target type</span>
                        <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm">
                            <option value="company">Company</option>
                            <option value="domain">Domain</option>
                            <option value="module">Module</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-xs text-slate-500">Target ID</span>
                        <input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="cmp_… / domain id" className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                    </label>
                    <label className="block">
                        <span className="text-xs text-slate-500">Module (optional)</span>
                        <input value={module} onChange={(e) => setModule(e.target.value)} placeholder="network_security…" className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                    </label>
                    <label className="block">
                        <span className="text-xs text-slate-500">Reason (optional)</span>
                        <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
                    </label>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={doPreview} disabled={!targetId || acting} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-guardian-navy text-white text-sm hover:bg-guardian-navy-800 disabled:opacity-50">
                        {acting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Preview / recalculate
                    </button>
                    <button onClick={doPublish} disabled={!preview?.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50">
                        <Send size={14} /> Publish
                    </button>
                    <button onClick={doRollback} disabled={!targetId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-200 text-slate-800 text-sm hover:bg-slate-300 disabled:opacity-50">
                        <RotateCcw size={14} /> Rollback
                    </button>
                    <button onClick={loadHistory} disabled={!targetId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-200 text-sm disabled:opacity-50">
                        History
                    </button>
                </div>
                {error && <div className="text-xs text-red-600">{typeof error === 'string' ? error : 'Request failed'}</div>}
                {queued && <div className="text-xs text-amber-700 px-3 py-2 bg-amber-50 border border-amber-200 rounded">Major score change queued for approval.</div>}
            </div>

            {preview && (
                <div className="bg-white border border-slate-200 rounded-lg p-5">
                    <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-3">Preview</h3>
                    <div className="flex items-end gap-6">
                        <div><div className="text-xs text-slate-400">Before</div><div className="text-3xl font-semibold text-slate-400">{preview.score_before ?? '—'}</div></div>
                        <div className="text-slate-300 text-2xl mb-1">→</div>
                        <div><div className="text-xs text-slate-400">After</div><div className="text-3xl font-semibold text-guardian-navy">{preview.score_after}</div></div>
                        <div className={`mb-2 text-sm font-medium ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                        </div>
                    </div>
                    {preview.contributing_findings?.length > 0 && (
                        <div className="mt-4">
                            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Contributing findings ({preview.contributing_findings.length})</div>
                            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                                {preview.contributing_findings.map((c, i) => (
                                    <div key={i} className="py-1.5 text-sm flex justify-between">
                                        <span className="text-slate-700 truncate">{c.title}</span>
                                        <span className="text-slate-400 text-xs">{c.module} · w{c.weight}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {history.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg p-5">
                    <h3 className="text-xs uppercase tracking-wide text-slate-400 mb-3">History</h3>
                    <div className="space-y-1">
                        {history.map((h) => (
                            <div key={h.id} className="text-sm flex justify-between border-b border-slate-50 py-1">
                                <span className="text-slate-600">{h.state} · {h.score_before ?? '—'} → {h.score_after}</span>
                                <span className="text-xs text-slate-400">{h.created_at ? new Date(h.created_at).toLocaleString() : ''}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
