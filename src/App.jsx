import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Routes, Route, Navigate } from 'react-router-dom';

import { fetchCurrentUser, selectAuthToken } from './features/auth/authSlice';

import RequireAuth         from './components/admin/RequireAuth';
import Layout              from './components/layout/Layout';

// Prior-bundle pages
import LoginPage           from './pages/LoginPage';
import OverviewPage        from './pages/OverviewPage';
import UsersPage           from './pages/UsersPage';
import CompaniesPage       from './pages/CompaniesPage';
import CompanyDetailPage   from './pages/CompanyDetailPage';
import DomainsPage         from './pages/DomainsPage';
import AssetsPage          from './pages/AssetsPage';
import TakedownsPage       from './pages/TakedownsPage';
import TakedownDetailPage  from './pages/TakedownDetailPage';
import LicensingPage       from './pages/LicensingPage';
import ApiHealthPage       from './pages/ApiHealthPage';
import AuditLogPage        from './pages/AuditLogPage';
import ActivityPage        from './pages/ActivityPage';

// God-mode pages (bundle 4)
import AlertsPage                from './pages/AlertsPage';
import AlertDetailPage           from './pages/AlertDetailPage';
import ScansPage                 from './pages/ScansPage';
import ScanDetailPage            from './pages/ScanDetailPage';
import ScanControlPage           from './pages/ScanControlPage';
import IssuesPage                from './pages/IssuesPage';
import IntegrationsPage          from './pages/IntegrationsPage';
import TicketsPage               from './pages/TicketsPage';
import NotificationLogPage       from './pages/NotificationLogPage';
import PrivacyOperationsPage     from './pages/PrivacyOperationsPage';
import ImpersonationSessionsPage from './pages/ImpersonationSessionsPage';
import FeatureFlagsPage          from './pages/FeatureFlagsPage';
import JobsPage                  from './pages/JobsPage';
import SystemHealthPage          from './pages/SystemHealthPage';
import AnnouncementsPage         from './pages/AnnouncementsPage';
import IncidentResponsePage      from './pages/IncidentResponsePage';

// Bundle 5 — cost monitoring + pricing
import CostsPage                 from './pages/CostsPage';
import PricingPlansPage          from './pages/PricingPlansPage';

// Pass 2 — login history
import LoginHistoryPage          from './pages/LoginHistoryPage';

// Pass 3 — module data CRUD (Brand Protection first; subsequent
// modules reuse ModuleDatasetPage with a different module slug).
import BrandProtectionPage       from './pages/BrandProtectionPage';
import DomainSecurityPage        from './pages/DomainSecurityPage';
import ApplicationSecurityPage   from './pages/ApplicationSecurityPage';
import NetworkSecurityPage       from './pages/NetworkSecurityPage';
import CloudSecurityPage         from './pages/CloudSecurityPage';
import CompliancePage            from './pages/CompliancePage';
import ModuleDatasetPage         from './pages/ModuleDatasetPage';

// Control plane (Phases 2-10)
import FindingsControlPage       from './pages/FindingsControlPage';
import ApiControlCentrePage      from './pages/ApiControlCentrePage';
import ScoringControlPage        from './pages/ScoringControlPage';
import ApprovalsPage             from './pages/ApprovalsPage';

/**
 * Top-level routing. Routes are categorised in the Sidebar; this file
 * maps URLs to page components. Capability gating is enforced
 * server-side AND presentationally (Sidebar hides items the user
 * can't action, page components render an access-denied panel if
 * reached by URL).
 */
export default function App() {
    const dispatch = useDispatch();
    const token    = useSelector(selectAuthToken);

    useEffect(() => {
        if (token) dispatch(fetchCurrentUser());
    }, [dispatch, token]);

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RequireAuth />}>
                <Route element={<Layout />}>
                    {/* Orient */}
                    <Route path="/" element={<OverviewPage />} />

                    {/* Tenants & people */}
                    <Route path="/users"              element={<UsersPage />} />
                    <Route path="/companies"          element={<CompaniesPage />} />
                    <Route path="/companies/:id"      element={<CompanyDetailPage />} />
                    <Route path="/domains"            element={<DomainsPage />} />
                    <Route path="/assets"             element={<AssetsPage />} />
                    <Route path="/impersonations"     element={<ImpersonationSessionsPage />} />
                    <Route path="/login-history"      element={<LoginHistoryPage />} />

                    {/* Module data CRUD — per-module landing pages +
                        a single generic dataset table that reads the
                        meta shape from the index response. */}
                    <Route path="/modules/brand-protection"            element={<BrandProtectionPage />} />
                    <Route path="/modules/domain-security"             element={<DomainSecurityPage />} />
                    <Route path="/modules/application-security"        element={<ApplicationSecurityPage />} />
                    <Route path="/modules/network-security"            element={<NetworkSecurityPage />} />
                    <Route path="/modules/cloud-security"              element={<CloudSecurityPage />} />
                    <Route path="/modules/compliance"                  element={<CompliancePage />} />
                    <Route path="/modules/:module/:dataset"            element={<ModuleDatasetPage />} />

                    {/* Operations */}
                    <Route path="/alerts"             element={<AlertsPage />} />
                    <Route path="/alerts/:id"         element={<AlertDetailPage />} />
                    <Route path="/issues"             element={<IssuesPage />} />
                    <Route path="/takedowns"          element={<TakedownsPage />} />
                    <Route path="/takedowns/:id"      element={<TakedownDetailPage />} />
                    <Route path="/scans"              element={<ScansPage />} />
                    <Route path="/scans/:id"          element={<ScanDetailPage />} />
                    <Route path="/scan-control"       element={<ScanControlPage />} />

                    {/* Platform & ops */}
                    <Route path="/api-health"         element={<ApiHealthPage />} />
                    <Route path="/api-health/:key"    element={<ApiHealthPage />} />
                    <Route path="/system-health"      element={<SystemHealthPage />} />
                    <Route path="/jobs"               element={<JobsPage />} />
                    <Route path="/notifications"      element={<NotificationLogPage />} />
                    <Route path="/integrations"       element={<IntegrationsPage />} />
                    <Route path="/tickets"            element={<TicketsPage />} />
                    <Route path="/feature-flags"      element={<FeatureFlagsPage />} />
                    <Route path="/announcements"      element={<AnnouncementsPage />} />

                    {/* Finance (bundle 5) */}
                    <Route path="/costs"              element={<CostsPage />} />
                    <Route path="/pricing"            element={<PricingPlansPage />} />
                    <Route path="/licensing"          element={<LicensingPage />} />

                    {/* Compliance & governance */}
                    <Route path="/audit"              element={<AuditLogPage />} />
                    <Route path="/activity"           element={<ActivityPage />} />
                    <Route path="/privacy"            element={<PrivacyOperationsPage />} />

                    {/* Incident */}
                    <Route path="/incident"           element={<IncidentResponsePage />} />

                    {/* Control plane (Phases 2-10) */}
                    <Route path="/findings"      element={<FindingsControlPage />} />
                    <Route path="/api-control"   element={<ApiControlCentrePage />} />
                    <Route path="/scoring"       element={<ScoringControlPage />} />
                    <Route path="/approvals"     element={<ApprovalsPage />} />
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
