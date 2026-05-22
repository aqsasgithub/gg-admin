import { configureStore } from '@reduxjs/toolkit';

// Auth + prior bundles (1–3)
import auth,              { forceLogout } from '../features/auth/authSlice';
import adminUsers         from '../features/admin/adminUsersSlice';
import adminCompanies     from '../features/admin/adminCompaniesSlice';
import adminLicensing     from '../features/admin/adminLicensingSlice';
import adminApiHealth     from '../features/admin/adminApiHealthSlice';
import adminAudit         from '../features/admin/adminAuditSlice';
import adminActivity      from '../features/admin/adminActivitySlice';
import adminDomains       from '../features/admin/adminDomainsSlice';
import adminAssets        from '../features/admin/adminAssetsSlice';
import adminTakedowns     from '../features/admin/adminTakedownsSlice';

// God-mode (bundle 4)
import adminAlerts        from '../features/admin/adminAlertsSlice';
import adminScans         from '../features/admin/adminScansSlice';
import adminScanControl   from '../features/admin/adminScanControlSlice';
import adminIssues        from '../features/admin/adminIssuesSlice';
import adminImpersonation from '../features/admin/adminImpersonationSlice';
import adminNotifications from '../features/admin/adminNotificationsSlice';
import adminPrivacy       from '../features/admin/adminPrivacySlice';
import adminIntegrations  from '../features/admin/adminIntegrationsSlice';
import adminTickets       from '../features/admin/adminTicketsSlice';
import adminSystem        from '../features/admin/adminSystemSlice';
import adminFlags         from '../features/admin/adminFlagsSlice';
import adminJobs          from '../features/admin/adminJobsSlice';
import adminAnnouncements from '../features/admin/adminAnnouncementsSlice';
import adminRateLimits    from '../features/admin/adminRateLimitsSlice';
import adminIncident      from '../features/admin/adminIncidentSlice';

// Cost monitoring + pricing (bundle 5)
import adminCosts         from '../features/admin/adminCostsSlice';
import adminPricing       from '../features/admin/adminPricingSlice';

// Login history (Pass 2)
import adminLoginHistory  from '../features/admin/adminLoginHistorySlice';

// Module data CRUD (Pass 3 — Brand Protection first; one slice handles
// every (module, dataset) pair via keyed state).
import adminModuleData    from '../features/admin/adminModuleDataSlice';

// Control plane (Phases 2-10): finding governance, API control, scoring,
// approvals. These layer on top of the existing admin surface.
import adminFindings      from '../features/admin/adminFindingsSlice';
import adminApiControl    from '../features/admin/adminApiControlSlice';
import adminScoring       from '../features/admin/adminScoringSlice';
import adminApprovals     from '../features/admin/adminApprovalsSlice';

import { setAuthHandlers } from '../api/client';

export const store = configureStore({
    reducer: {
        auth,
        // Bundles 1–3
        adminUsers,
        adminCompanies,
        adminLicensing,
        adminApiHealth,
        adminAudit,
        adminActivity,
        adminDomains,
        adminAssets,
        adminTakedowns,
        // Bundle 4
        adminAlerts,
        adminScans,
        adminScanControl,
        adminIssues,
        adminImpersonation,
        adminNotifications,
        adminPrivacy,
        adminIntegrations,
        adminTickets,
        adminSystem,
        adminFlags,
        adminJobs,
        adminAnnouncements,
        adminRateLimits,
        adminIncident,
        // Bundle 5
        adminCosts,
        adminPricing,
        // Pass 2
        adminLoginHistory,
        // Pass 3
        adminModuleData,
        // Control plane (Phases 2-10)
        adminFindings,
        adminApiControl,
        adminScoring,
        adminApprovals,
    },
});

setAuthHandlers({
    getToken: () => store.getState().auth.token,
    onUnauthorized: () => {
        store.dispatch(forceLogout());
        if (window.location.pathname !== '/login') {
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.assign(`/login?next=${next}`);
        }
    },
});
