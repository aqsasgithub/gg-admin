import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Radar, Search, RefreshCcw, Building2, X, ExternalLink, ScanLine, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';
import {
    searchThreatIntelCompanies, fetchThreatIndicators, rescanThreatIntelSources,
    selectThreatIntelCompany, setThreatIntelFilter, clearThreatIntelFilters,
    openThreatIndicator, closeThreatIndicator, resetThreatIntel,
    selectTiCompany, selectTiCompanyResults, selectTiSearching,
    selectTiIndicators, selectTiMeta, selectTiLoading, selectTiError,
    selectTiFilters, selectTiSelected, selectTiRescanning, selectTiRescanError,
    setThreatIntelPage, askDeleteThreatIndicator, cancelDeleteThreatIndicator,
    deleteThreatIndicator, selectTiPage, selectTiPendingDelete, selectTiDeletingId,
} from '../features/admin/threatIntelSlice';
import { selectAdminCapabilities } from '../features/auth/authSlice';
import { setCompany as setAdminContextCompany } from '../features/admin/adminContextSlice';

/**
 * Threat Intelligence — aggregated indicator feed.
 *
 *   /threat-intelligence
 *
 * Threat Intelligence is not a scanner: the server projects data the platform
 * already holds (fake domains, abusive IPs, analyst-curated manual
 * indicators) into one canonical indicator shape. One finding = one indicator.
 *
 * SEARCH-FIRST
 * ------------
 * The page opens with no indicators. The operator searches for a company
 * (JazzCash, Geo, J.) and the feed is generated for that company only.
 *
 * DELIBERATELY MINIMAL
 * --------------------
 * The list shows exactly three columns — Indicator ID, Type, Title — and each
 * row opens a detail panel containing every field. This is the agreed first
 * cut for review; the detail panel renders whatever the API returns rather
 * than a fixed field list, so extending it costs no UI work.
 */

const SEVERITY_STYLES = {
    critical: 'bg-red-100 text-red-800 ring-red-200',
    high:     'bg-orange-100 text-orange-800 ring-orange-200',
    medium:   'bg-amber-100 text-amber-800 ring-amber-200',
    low:      'bg-emerald-100 text-emerald-800 ring-emerald-200',
    info:     'bg-sky-100 text-sky-800 ring-sky-200',
};

function SeverityPill({ label }) {
    const cls = SEVERITY_STYLES[String(label ?? '').toLowerCase()] ?? 'bg-slate-100 text-slate-700 ring-slate-200';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ring-1 capitalize ${cls}`}>
            {label ?? '?'}
        </span>
    );
}

/** Field labels the API never sends but a human still wants to read nicely. */
const humanise = (key) => String(key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Fields rendered in the detail panel's header rather than the field grid. */
const HEADER_FIELDS = new Set(['indicator_id', 'title', 'severity', 'evidence', 'evidence_count']);

export default function ThreatIntelligencePage() {
    const dispatch = useDispatch();

    const company        = useSelector(selectTiCompany);
    const companyResults = useSelector(selectTiCompanyResults);
    const searching      = useSelector(selectTiSearching);
    const indicators     = useSelector(selectTiIndicators);
    const meta           = useSelector(selectTiMeta);
    const loading        = useSelector(selectTiLoading);
    const error          = useSelector(selectTiError);
    const filters        = useSelector(selectTiFilters);
    const selected       = useSelector(selectTiSelected);
    const rescanning     = useSelector(selectTiRescanning);
    const page           = useSelector(selectTiPage);
    const pendingDelete  = useSelector(selectTiPendingDelete);
    const deletingId     = useSelector(selectTiDeletingId);
    const rescanError    = useSelector(selectTiRescanError);
    const caps           = useSelector(selectAdminCapabilities);

    // Re-scan hits upstream through the orchestrator, so it needs the same
    // capability an admin-initiated scan needs. Roles holding only
    // threat_intel.read keep the instant, cache-only Refresh.
    const canRescan = caps.includes('*') || caps.includes('scans.run');
    // Deletion mutates the underlying scan data, so it is gated on the
    // separate write capability — support/viewer keep read-only access.
    const canDelete = caps.includes('*') || caps.includes('threat_intel.write');

    const navigate              = useNavigate();
    const [term, setTerm]       = useState('');
    const [open, setOpen]       = useState(false);
    const debounceRef           = useRef(null);
    const boxRef                = useRef(null);
    // Set when the term change came from PICKING a company rather than typing.
    // Without it, pick() writes the company name into the input, the debounce
    // effect treats that as a new query, and the dropdown springs straight
    // back open — the "have to click twice" behaviour.
    const skipSearchRef         = useRef(false);

    // Leaving the page returns it to the empty search-first state, so an
    // operator never lands on another tenant's feed from a stale mount.
    useEffect(() => () => { dispatch(resetThreatIntel()); }, [dispatch]);

    // Debounced typeahead — one request per pause, not per keystroke. The
    // dropdown is opened from the async callback (and closed by the input
    // handler) so the effect body never sets state synchronously.
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        // The term was set by a selection, not by typing — consume the flag
        // and do not re-open the dropdown.
        if (skipSearchRef.current) {
            skipSearchRef.current = false;
            return undefined;
        }

        if (!term.trim()) return undefined;

        debounceRef.current = setTimeout(() => {
            dispatch(searchThreatIntelCompanies(term));
            setOpen(true);
        }, 250);

        return () => clearTimeout(debounceRef.current);
    }, [term, dispatch]);

    // Close the dropdown on an outside click or Escape — previously it stayed
    // open over the results table until something else was clicked inside it.
    useEffect(() => {
        if (!open) return undefined;

        const onPointerDown = (e) => {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };
        const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false); };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    // The feed loads immediately on mount with NO company selected — the
    // default listing spans every company. Selecting a company narrows it;
    // clearing the search widens it again. Filters and paging re-fetch too.
    useEffect(() => {
        dispatch(fetchThreatIndicators({ companyId: company?.id ?? null, filters, page }));
    }, [dispatch, company, filters, page]);

    const pick = (c) => {
        skipSearchRef.current = true;
        dispatch(selectThreatIntelCompany(c));
        setTerm(c.name ?? '');
        setOpen(false);
    };

    /**
     * Farhan: "manually add ka option laazmii ho".
     *
     * Deep-links to the EXACT dataset screen — Brand Protection → Social /
     * Manual Indicators — and pre-selects the company the operator is already
     * looking at, so the form opens scoped correctly. Still the one existing
     * write path; no second store, no second form.
     */
    const goToManualEntry = () => {
        if (company?.id) dispatch(setAdminContextCompany(company.id));
        navigate('/modules/brand-protection/social-indicators');
    };

    // The orchestrator runs one domain at a time; use the company's primary.
    // Prefer the typeahead value, fall back to the feed meta.
    const companyDomainId = company?.domain_id ?? meta?.company?.domain_id ?? null;

    // Three fixed columns, plus the actions column when the operator can delete.
    const colCount = canDelete ? 4 : 3;

    const sourceCatalogue = meta?.sources ?? [];
    const sourceCounts    = meta?.source_breakdown ?? {};
    const activeFilters   = useMemo(
        () => Object.values(filters).filter((v) => v !== '' && v != null).length,
        [filters],
    );

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                    <Radar size={22} /> Threat Intelligence
                </h1>
                <p className="text-sm text-slate-600">
                    Aggregated indicator feed built from data the platform already holds — fake domains,
                    abusive IPs and analyst-curated manual indicators. Search for a company to narrow the feed.
                </p>
            </header>

            {/* Company search */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Company
                </label>
                <div className="relative max-w-lg" ref={boxRef}>
                    <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                        type="text"
                        value={term}
                        onChange={(e) => {
                            const next = e.target.value;
                            setTerm(next);
                            if (!next.trim()) setOpen(false);
                        }}
                        onFocus={() => { if (companyResults.length) setOpen(true); }}
                        placeholder="Search by company name or domain — e.g. JazzCash"
                        className="w-full pl-8 pr-8 py-2 text-sm border border-slate-300 rounded-md"
                    />
                    {term && (
                        <button
                            type="button"
                            onClick={() => { setTerm(''); setOpen(false); dispatch(resetThreatIntel()); }}
                            className="absolute right-2 top-2 text-slate-400 hover:text-slate-700"
                            aria-label="Clear company search"
                        >
                            <X size={16} />
                        </button>
                    )}

                    {open && (
                        <ul className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-64 overflow-auto">
                            {searching && <li className="px-3 py-2 text-sm text-slate-500">Searching…</li>}
                            {!searching && companyResults.length === 0 && (
                                <li className="px-3 py-2 text-sm text-slate-500">No matching company.</li>
                            )}
                            {companyResults.map((c) => (
                                <li key={c.id}>
                                    <button
                                        type="button"
                                        onClick={() => pick(c)}
                                        className="w-full text-left px-3 py-2 hover:bg-slate-50"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Building2 size={14} className="text-slate-400 shrink-0" />
                                            <span className="text-sm text-slate-800">{c.name}</span>
                                            {c.domain && <span className="text-xs text-slate-500">{c.domain}</span>}
                                        </span>
                                        {/* Several tenants can share a display name, and a company
                                            can match on a NON-primary domain. Show the id and the
                                            actual matched value so every row visibly earns its
                                            place and duplicates are distinguishable. */}
                                        <span className="flex items-center gap-2 pl-6 mt-0.5">
                                            <span className="text-[10px] font-mono text-slate-400">{c.id}</span>
                                            {c.matched_on === 'domain' && c.matched_domain && (
                                                <span className="text-[10px] text-amber-700">
                                                    matched domain: {c.matched_domain}
                                                </span>
                                            )}
                                            {c.domain_count > 1 && (
                                                <span className="text-[10px] text-slate-400">
                                                    {c.domain_count} domains
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

                {/* Summary + source filter chips */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-sm text-slate-700">
                            {/* Company selected => scoped feed. Otherwise the
                                default cross-company listing. */}
                            {company ? (
                                <>
                                    <span className="font-semibold text-guardian-navy">{company.name}</span>
                                    {meta?.company?.country && (
                                        <span className="text-slate-500"> · {meta.company.country}</span>
                                    )}
                                </>
                            ) : (
                                <span className="font-semibold text-guardian-navy">All companies</span>
                            )}
                            <span className="text-slate-500">
                                {' '}· {activeFilters > 0
                                    ? `${meta?.total ?? 0} of ${meta?.total_unfiltered ?? 0} indicators`
                                    : `${meta?.total ?? 0} indicator${(meta?.total ?? 0) === 1 ? '' : 's'}`}
                                {!company && (meta?.companies_scanned ?? 0) > 0 && (
                                    ` · ${meta.companies_scanned} companies`
                                )}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Farhan: "manually add ka option laazmii ho".
                                Deep-links to the EXISTING manual-indicator
                                screen rather than adding a second write
                                path — analysts keep one place to enter
                                manual data and it feeds straight back here. */}
                            <button
                                type="button"
                                onClick={goToManualEntry}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
                                title={company
                                    ? `Add a manual indicator for ${company.name} in Brand Protection → Social / Manual Indicators`
                                    : 'Add a manual indicator in Brand Protection → Social / Manual Indicators'}
                            >
                                <Plus size={14} /> Add manual indicator
                            </button>

                            {canRescan && companyDomainId && (
                                <button
                                    type="button"
                                    onClick={() => dispatch(rescanThreatIntelSources({
                                        companyId: company.id,
                                        domainId:  companyDomainId,
                                    }))}
                                    disabled={rescanning || loading}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
                                    title="Run Brand Protection upstream and rebuild the feed from fresh results"
                                >
                                    <ScanLine size={14} className={rescanning ? 'animate-pulse' : ''} />
                                    {rescanning ? 'Re-scanning…' : 'Re-scan from source'}
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => dispatch(fetchThreatIndicators({
                                    companyId: company?.id ?? null, filters, page, refresh: true,
                                }))}
                                disabled={loading || rescanning}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
                            >
                                <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                            </button>
                        </div>
                    </div>

                    {/* Provenance summary. Shown ONLY on a company-scoped feed,
                        where it explains a row whose value looks unrelated to
                        the company name. On the cross-company listing every
                        indicator already carries its own "from …" line, so the
                        same list would be dozens of domains of pure noise. */}
                    {company && (meta?.monitored_domains_total ?? 0) > 1 && (
                        <p className="text-xs text-slate-500">
                            Spans {meta.monitored_domains_total} monitored domains:{' '}
                            {(meta.monitored_domains ?? []).map((d) => `${d.domain} (${d.count})`).join(' · ')}
                            {(meta.monitored_domains_total ?? 0) > (meta.monitored_domains?.length ?? 0) && (
                                ` · +${meta.monitored_domains_total - meta.monitored_domains.length} more`
                            )}
                        </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                        <Chip
                            active={filters.source_key === ''}
                            label="All sources"
                            count={meta?.total_unfiltered ?? 0}
                            onClick={() => dispatch(setThreatIntelFilter({ key: 'source_key', value: '' }))}
                        />
                        {sourceCatalogue.map((s) => (
                            <Chip
                                key={s.key}
                                active={filters.source_key === s.key}
                                label={s.label}
                                count={sourceCounts[s.key] ?? 0}
                                onClick={() => dispatch(setThreatIntelFilter({ key: 'source_key', value: s.key }))}
                            />
                        ))}
                        {activeFilters > 0 && (
                            <button
                                type="button"
                                onClick={() => dispatch(clearThreatIntelFilters())}
                                className="text-xs text-slate-500 hover:text-slate-800 underline ml-1"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>

                {rescanning && (
                    <div className="bg-sky-50 border border-sky-200 text-sky-800 text-sm rounded-md px-4 py-2">
                        Running Brand Protection upstream for {company?.name}. This can take a few minutes —
                        the feed rebuilds automatically when it finishes.
                    </div>
                )}

                {/* A config ceiling was hit (threat_intel.listing.*). Say so
                    plainly rather than implying the total is complete —
                    searching a company reads that company's feed uncapped. */}
                {meta?.truncated && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-md px-4 py-2">
                        Showing a partial feed — the cross-company listing is capped for performance.
                        Search for a company to see its complete, uncapped indicator list.
                    </div>
                )}

                {(error || rescanError) && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-md px-4 py-2">
                        {error || rescanError}
                    </div>
                )}

                {/* Indicator list — three columns by design; the row opens everything else. */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                            <tr>
                                <th className="text-left font-semibold px-3 py-2.5 w-40">Indicator ID</th>
                                <th className="text-left font-semibold px-3 py-2.5 w-52">Indicator Type</th>
                                <th className="text-left font-semibold px-3 py-2.5">Indicator Title</th>
                                {canDelete && <th className="w-12 px-3 py-2.5"><span className="sr-only">Actions</span></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && (
                                <tr><td colSpan={colCount} className="px-3 py-6 text-center text-slate-500">Loading indicators…</td></tr>
                            )}
                            {!loading && indicators.length === 0 && (
                                <tr><td colSpan={colCount} className="px-3 py-6 text-center text-slate-500">
                                    No indicators match the current filters.
                                </td></tr>
                            )}
                            {!loading && indicators.map((i) => (
                                <tr
                                    key={i.indicator_id}
                                    onClick={() => dispatch(openThreatIndicator(i))}
                                    className="hover:bg-slate-50 cursor-pointer"
                                >
                                    <td className="px-3 py-2.5 font-mono text-xs text-guardian-navy">{i.indicator_id}</td>
                                    <td className="px-3 py-2.5 text-slate-700">
                                        {String(i.indicator_type ?? '').replace(/_/g, ' ')}
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-800">
                                        {i.title}
                                        {i.monitored_domain && (
                                            <span className="block text-[11px] text-slate-400">
                                                from {i.monitored_domain}
                                            </span>
                                        )}
                                    </td>
                                    {canDelete && (
                                        <td className="px-3 py-2.5 text-right">
                                            <button
                                                type="button"
                                                // The row itself opens the detail panel; stop the
                                                // click here so deleting never also opens it.
                                                onClick={(e) => { e.stopPropagation(); dispatch(askDeleteThreatIndicator(i)); }}
                                                disabled={deletingId === i.indicator_id}
                                                className="p-1.5 rounded text-slate-400 hover:text-red-700 hover:bg-red-50 disabled:opacity-40"
                                                title="Delete this indicator"
                                                aria-label={`Delete ${i.indicator_id}`}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Server-side pagination — the default cross-company feed
                        is far too large to render in one go. */}
                    {(meta?.last_page ?? 1) > 1 && (
                        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 text-sm">
                            <span className="text-slate-500">
                                Page {meta.page} of {meta.last_page} · {meta.total} indicators
                            </span>
                            <span className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => dispatch(setThreatIntelPage(Math.max(1, page - 1)))}
                                    disabled={loading || page <= 1}
                                    className="inline-flex items-center gap-1 px-2 py-1 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40"
                                >
                                    <ChevronLeft size={14} /> Prev
                                </button>
                                <button
                                    type="button"
                                    onClick={() => dispatch(setThreatIntelPage(page + 1))}
                                    disabled={loading || page >= (meta?.last_page ?? 1)}
                                    className="inline-flex items-center gap-1 px-2 py-1 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40"
                                >
                                    Next <ChevronRight size={14} />
                                </button>
                            </span>
                        </div>
                    )}
                </div>

            {selected && <IndicatorDetail indicator={selected} onClose={() => dispatch(closeThreatIndicator())} />}

            {/* Reuses the portal-wide confirmation modal so deletion looks and
                behaves exactly like every other destructive admin action. */}
            <AdminConfirmModal
                open={Boolean(pendingDelete)}
                variant="destructive"
                title="Delete this indicator?"
                description={
                    pendingDelete
                        ? `${pendingDelete.indicator_id} — ${pendingDelete.title}. `
                          + (pendingDelete.source_key === 'manual'
                              ? 'This permanently deletes the analyst-recorded indicator and re-scores the company. '
                                + 'It can only come back if an analyst adds it again.'
                              : 'This permanently removes the finding from the stored scan data. '
                                + 'Note that a future scan can legitimately re-discover it.')
                        : ''
                }
                confirmLabel="Delete indicator"
                onCancel={() => dispatch(cancelDeleteThreatIndicator())}
                onConfirm={() => dispatch(deleteThreatIndicator({ indicator: pendingDelete })).unwrap()}
            />
        </div>
    );
}

function Chip({ active, label, count, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full ring-1 transition ${
                active
                    ? 'bg-guardian-navy text-white ring-guardian-navy'
                    : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}
        >
            {label}
            <span className={active ? 'text-white/70' : 'text-slate-400'}>{count}</span>
        </button>
    );
}

/**
 * Detail panel.
 *
 * Renders whatever the API returned rather than a hard-coded field list: the
 * indicator shape varies by source (a manual indicator carries platform /
 * issue_types / related_brands that a fake domain does not), and future
 * sources will add more. Nothing here needs changing when they do.
 */
function IndicatorDetail({ indicator, onClose }) {
    const evidence = indicator.evidence && typeof indicator.evidence === 'object' ? indicator.evidence : {};

    const fields = Object.entries(indicator)
        .filter(([k, v]) => !HEADER_FIELDS.has(k) && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl bg-white rounded-lg shadow-xl max-h-[88vh] flex flex-col">
                <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-slate-500">{indicator.indicator_id}</span>
                            <SeverityPill label={indicator.severity} />
                        </div>
                        <h3 className="text-base font-semibold text-guardian-navy mt-1">{indicator.title}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 text-xl leading-none shrink-0"
                        aria-label="Close indicator detail"
                    >
                        ×
                    </button>
                </div>

                <div className="p-5 overflow-auto space-y-5">
                    <section>
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Indicator</h4>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                            {fields.map(([key, value]) => (
                                <div key={key} className="min-w-0">
                                    <dt className="text-[11px] text-slate-500">{humanise(key)}</dt>
                                    <dd className="text-sm text-slate-800 break-words">
                                        <FieldValue name={key} value={value} />
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </section>

                    <section>
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                            Evidence ({indicator.evidence_count ?? Object.keys(evidence).length})
                        </h4>
                        {Object.keys(evidence).length === 0 ? (
                            <p className="text-sm text-slate-500">No supporting evidence recorded.</p>
                        ) : (
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                                {Object.entries(evidence).map(([key, value]) => (
                                    <div key={key} className="min-w-0">
                                        <dt className="text-[11px] text-slate-500">{humanise(key)}</dt>
                                        <dd className="text-sm text-slate-800 break-words">
                                            <FieldValue name={key} value={value} />
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}

function FieldValue({ name, value }) {
    if (Array.isArray(value)) {
        return (
            <span className="flex flex-wrap gap-1">
                {value.map((v, idx) => (
                    <span key={`${name}-${idx}`} className="inline-flex px-1.5 py-0.5 text-[11px] bg-slate-100 text-slate-700 rounded">
                        {String(v).replace(/_/g, ' ')}
                    </span>
                ))}
            </span>
        );
    }

    if (typeof value === 'object' && value !== null) {
        return <span className="text-slate-500">{JSON.stringify(value)}</span>;
    }

    const str = String(value);

    if (/^https?:\/\//i.test(str)) {
        return (
            <a
                href={str}
                target="_blank"
                rel="noreferrer noopener"
                className="text-blue-600 hover:underline inline-flex items-center gap-1 break-all"
            >
                {str} <ExternalLink size={12} className="shrink-0" />
            </a>
        );
    }

    return <span>{str}</span>;
}
