import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Building2, Globe, X } from 'lucide-react';
import {
    fetchAdminCompanies, selectAdminCompanies,
} from '../../features/admin/adminCompaniesSlice';
import {
    fetchCompanyDomains, selectCompanyDomains,
} from '../../features/admin/adminDomainsSlice';
import {
    setCompany, setDomain, clearContext,
    selectAdminContextCompanyId, selectAdminContextDomainId,
} from '../../features/admin/adminContextSlice';

/**
 * AdminContextBar — sticky picker for the (company, domain) context.
 *
 * Mount above every module page. Whatever is picked here is auto-attached
 * as X-Admin-Company-Id / X-Admin-Domain-Id headers on every
 * /admin/modules/* call (see src/api/client.js interceptor). The server's
 * `admin.context` middleware folds those headers into the request input
 * as company_id / domain_id so module-CRUD endpoints work without the
 * admin typing IDs into any payload or filter.
 *
 * Reads from existing slices — no new fetchers. Domains list re-fetches
 * whenever the company changes.
 */
export default function AdminContextBar() {
    const dispatch  = useDispatch();
    const companyId = useSelector(selectAdminContextCompanyId);
    const domainId  = useSelector(selectAdminContextDomainId);
    const companies = useSelector(selectAdminCompanies);
    const domains   = useSelector((s) => selectCompanyDomains(s, companyId));

    // Fetch a generous page of companies for the picker. If you have
    // more than this, the user can search via the Companies page first
    // and arrive here with the company already pinned.
    useEffect(() => {
        if (!companies?.length) {
            dispatch(fetchAdminCompanies({ per_page: 200 }));
        }
    }, [dispatch, companies?.length]);

    useEffect(() => {
        if (companyId) {
            dispatch(fetchCompanyDomains({ companyId }));
        }
    }, [dispatch, companyId]);

    const selectedCompany = useMemo(
        () => companies?.find((c) => c.id === companyId) ?? null,
        [companies, companyId],
    );
    const selectedDomain = useMemo(
        () => domains?.find((d) => d.id === domainId) ?? null,
        [domains, domainId],
    );

    return (
        <div className="sticky top-0 z-20 bg-white border border-slate-200 rounded-lg px-3 py-2 mb-4 flex flex-wrap items-center gap-3 shadow-sm">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Module context
            </span>

            <div className="flex items-center gap-1.5">
                <Building2 size={14} className="text-slate-400" />
                <select
                    value={companyId ?? ''}
                    onChange={(e) => dispatch(setCompany(e.target.value || null))}
                    className="px-2 py-1 text-sm border border-slate-300 rounded-md min-w-[200px]"
                >
                    <option value="">— Pick a company —</option>
                    {companies?.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name} {c.domain ? `(${c.domain})` : ''}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex items-center gap-1.5">
                <Globe size={14} className="text-slate-400" />
                <select
                    value={domainId ?? ''}
                    onChange={(e) => dispatch(setDomain(e.target.value || null))}
                    disabled={!companyId}
                    className="px-2 py-1 text-sm border border-slate-300 rounded-md min-w-[200px] disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                    <option value="">— All domains —</option>
                    {domains?.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.domain}{d.is_primary ? ' (primary)' : ''}
                        </option>
                    ))}
                </select>
            </div>

            {(companyId || domainId) && (
                <button
                    type="button"
                    onClick={() => dispatch(clearContext())}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                    title="Clear picked context"
                >
                    <X size={12} /> Clear
                </button>
            )}

            <span className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
                {selectedCompany && (
                    <span className="font-mono">{selectedCompany.id}</span>
                )}
                {selectedDomain && (
                    <span className="font-mono">/ {selectedDomain.id}</span>
                )}
                {!companyId && (
                    <span className="text-amber-700">
                        Pick a company to scope module CRUD.
                    </span>
                )}
            </span>
        </div>
    );
}
