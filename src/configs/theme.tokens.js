/**
 * theme.tokens.js — palette tokens for the admin portal.
 *
 * ⚠️ This file is intentionally an EXACT copy of the customer client's
 *    `client/src/configs/theme.tokens.js`. Both apps share the same brand
 *    + risk colors so an HIGH severity badge looks the same in both UIs.
 *
 *    If you change the palette here, change it in the customer client in
 *    the same commit. Drift between the two will produce inconsistent
 *    severity coloring across the platform.
 *
 * Two consumers read from this file in the admin app:
 *   1. `tailwind.config.js`         → builds utility classes (bg-risk-low, etc.)
 *   2. JS that writes inline styles or Recharts fills → reads the same hex.
 */

// ── Brand ────────────────────────────────────────────────────────────────────
export const BRAND = {
    navy:             '#1a1f4e',
    primary:          '#6060A6',
    primarySecondary: 'rgba(96, 96, 166, 0.1)',
};

// ── Risk tiers (lower = safer) ───────────────────────────────────────────────
// LOW and HEALTHY share the SAME forest green. See the customer client's
// tokens file for the full reasoning.
export const RISK = {
    healthy:  { DEFAULT: '#16a34a', secondary: '#dcfce7' },
    low:      { DEFAULT: '#16a34a', secondary: '#dcfce7' },
    medium:   { DEFAULT: '#ca8a04', secondary: '#fef9c3' },
    high:     { DEFAULT: '#c13737', secondary: '#fee2e2' },
    critical: { DEFAULT: '#b91c1c', secondary: '#fee2e2' },
    neutral:  { DEFAULT: '#6b7280', secondary: '#f3f4f6' },
};

// ── Surface layers ───────────────────────────────────────────────────────────
export const SURFACE = {
    base:     '#ffffff',
    sunken:   '#f3f4f6',
    muted:    '#f8fafc',
    elevated: '#ffffff',
    raised:   '#ffffff',
    overlay:  'rgba(15, 23, 42, 0.5)',
};

// ── Border tones ─────────────────────────────────────────────────────────────
export const BORDER = {
    subtle:  '#e5e7eb',
    default: '#d1d5db',
    strong:  '#9ca3af',
    focus:   '#6060A6',
};

// ── Text tones ───────────────────────────────────────────────────────────────
export const TEXT = {
    strong:    '#111827',
    primary:   '#1f2937',
    secondary: '#4b5563',
    tertiary:  '#6b7280',
    muted:     '#9ca3af',
    disabled:  '#d1d5db',
    onAccent:  '#ffffff',
};

// ── Chart palette ────────────────────────────────────────────────────────────
export const CHART = {
    primary:   '#6060A6',
    secondary: '#8B5CF6',
    tertiary:  '#2563EB',
    accent:    '#0891B2',
    success:   '#059669',
    warning:   '#D97706',
    indigo:    '#4F46E5',
    muted:     '#94A3B8',
    grid:      '#F1F5F9',
};

// ── Module ↔ chart colour map ────────────────────────────────────────────────
export const MODULE_COLOR = {
    brand_protection:     CHART.secondary,
    domain_security:      CHART.tertiary,
    application_security: CHART.accent,
    network_security:     CHART.success,
    compliance:           CHART.warning,
    cloud_security:       CHART.indigo,
};

// ── Tier → color helper ──────────────────────────────────────────────────────
export const tierColor = (tier) => {
    const t = (tier || '').toUpperCase();
    if (t === 'HEALTHY' || t === 'SAFE') return RISK.healthy.DEFAULT;
    if (t === 'LOW')                     return RISK.low.DEFAULT;
    if (t === 'MODERATE' || t === 'MEDIUM') return RISK.medium.DEFAULT;
    if (t === 'HIGH')                    return RISK.high.DEFAULT;
    if (t === 'CRITICAL')                return RISK.critical.DEFAULT;
    return RISK.neutral.DEFAULT;
};
