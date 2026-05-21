import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Globe, Search } from 'lucide-react';
import {
    fetchAdminCompanies, selectAdminCompanies, selectAdminCompaniesLoading,
} from '../features/admin/adminCompaniesSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';

/**
 * Cross-tenant domain overview. The actual per-domain CRUD lives inside
 * a company's detail page — this page is the "show me everything
 * across the platform" view, useful for ops and support.
 *
 * The backend doesn't expose a cross-tenant domain endpoint by design:
 * domain lists belong to a tenant. So this page works by listing
 * companies with their domain counts and linking through. If you need
 * a true flat list, add it to AdminDomainController as a separate route.
 */
export default function DomainsPage() {
    const dispatch  = useDispatch();
    const companies = useSelector(selectAdminCompanies);
    const loading   = useSelector(selectAdminCompaniesLoading);

    const [filters, setFilters] = useState({});

    useEffect(() => {
        dispatch(fetchAdminCompanies({ ...filters, per_page: 100 }));
    }, [dispatch, filters]);

    const summary = useMemo(() => {
        let totalDomains = 0, totalScanned = 0;
        for (const c of companies) {
            totalDomains += c.domains_total ?? 0;
            totalScanned += c.domains_scanned ?? 0;
        }
        return { totalDomains, totalScanned, totalCompanies: companies.length };
    }, [companies]);

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy">Domains</h1>
                <p className="text-sm text-slate-600">
                    Domain inventory across all tenants. Drill into a company to add, edit, or bulk-import domains.
                </p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatBox label="Companies"      value={summary.totalCompanies} />
                <StatBox label="Domains total"  value={summary.totalDomains} />
                <StatBox label="Domains scanned" value={summary.totalScanned} />
            </div>

            <AdminFilterBar
                filters={[
                    { key: 'search', type: 'text', label: 'Search', placeholder: 'Company name or primary domain...' },
                ]}
                value={filters}
                onChange={setFilters}
                onClear={() => setFilters({})}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Company</th>
                            <th className="px-3 py-2 text-left">Primary domain</th>
                            <th className="px-3 py-2 text-right">Domains</th>
                            <th className="px-3 py-2 text-right">Scanned</th>
                            <th className="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !companies.length ? (
                            <tr><td colSpan="5" className="px-3 py-8 text-center text-slate-500">Loading...</td></tr>
                        ) : !companies.length ? (
                            <tr><td colSpan="5" className="px-3 py-8 text-center text-slate-500">No companies match this filter.</td></tr>
                        ) : companies.map((c) => (
                            <tr key={c.id}>
                                <td className="px-3 py-2.5">
                                    <Link to={`/companies/${c.id}?tab=domains`} className="font-medium text-slate-900 hover:text-guardian-navy">
                                        {c.name}
                                    </Link>
                                    <div className="text-[10px] font-mono text-slate-400">{c.id}</div>
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 font-mono text-xs">{c.domain ?? '—'}</td>
                                <td className="px-3 py-2.5 text-right text-slate-700">{c.domains_total ?? 0}</td>
                                <td className="px-3 py-2.5 text-right text-slate-700">{c.domains_scanned ?? 0}</td>
                                <td className="px-3 py-2.5 text-right">
                                    <Link to={`/companies/${c.id}?tab=domains`}
                                        className="inline-flex items-center gap-1 text-xs text-guardian-navy hover:underline">
                                        <Globe size={12} /> Manage
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatBox({ label, value }) {
    return (
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-semibold text-guardian-navy">{value}</div>
        </div>
    );
}
