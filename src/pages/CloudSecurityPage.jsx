import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { ChevronRight, Server, Database } from 'lucide-react';
import AdminContextBar from '../components/admin/AdminContextBar';
import {
    fetchModuleOverview, selectModuleOverview,
} from '../features/admin/adminModuleDataSlice';

/**
 * /modules/cloud-security
 *
 * Lists the 3 Cloud Security datasets (scans, findings, connections).
 * encrypted_credentials are never returned by the API — even on the
 * detail view — so the admin portal cannot surface them.
 */
export default function CloudSecurityPage() {
    const dispatch = useDispatch();
    const overview = useSelector((s) => selectModuleOverview(s, 'cloud-security'));

    useEffect(() => {
        dispatch(fetchModuleOverview('cloud-security'));
    }, [dispatch]);

    const datasets = overview?.datasets ?? [];

    return (
        <div className="p-6 space-y-4">
            <AdminContextBar />
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy flex items-center gap-2">
                    <Server size={22} /> Cloud Security — Module Data
                </h1>
                <p className="text-sm text-slate-600">
                    Direct CRUD access to Cloud Security datasets (scans, per-tool findings,
                    provider connections). Pick a company and domain above to scope what
                    you see. Encrypted credentials on cloud_connections are never exposed.
                </p>
            </header>

            {!overview ? (
                <div className="text-sm text-slate-500 py-12 text-center">Loading datasets…</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {datasets.map((d) => (
                        <Link key={d.slug} to={`/modules/cloud-security/${d.slug}`}
                            className="block bg-white border border-slate-200 rounded-lg p-4 hover:border-guardian-navy hover:shadow-card transition">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-slate-900">{d.label}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">{d.description}</div>
                                </div>
                                <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
                            </div>
                            <div className="mt-4 flex items-center gap-4 text-xs text-slate-600">
                                <div className="flex items-center gap-1">
                                    <Database size={12} className="text-slate-400" />
                                    <span className="font-semibold text-slate-900">{d.total_records.toLocaleString()}</span> total
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
