/**
 * Tailwind configuration for the admin portal.
 *
 * Mirrors the customer client's tailwind.config.js: every palette value is
 * sourced from `src/configs/theme.tokens.js`, which is intentionally an
 * EXACT copy of the customer client's tokens file. Both files must stay
 * in sync — if you change the customer palette, change the admin palette
 * in lockstep so severity/risk colors remain identical across both UIs.
 *
 * The admin shell layers on additional operator-oriented tokens
 * (`operator.*`) for dense table chrome — these are admin-specific and
 * have no counterpart in the customer UI.
 */
/** @type {import('tailwindcss').Config} */
import { BRAND, RISK, SURFACE, BORDER, TEXT, CHART } from './src/configs/theme.tokens.js';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'guardian-navy': BRAND.navy,
        primary: {
          DEFAULT: BRAND.primary,
          secondary: BRAND.primarySecondary,
        },

        // Legacy severity tokens — kept identical to risk-* for component
        // libraries imported from the customer app.
        critical: { DEFAULT: RISK.critical.DEFAULT, secondary: RISK.critical.secondary },
        high:     { DEFAULT: RISK.high.DEFAULT,     secondary: RISK.high.secondary     },
        medium:   { DEFAULT: RISK.medium.DEFAULT,   secondary: RISK.medium.secondary   },
        low:      { DEFAULT: RISK.low.DEFAULT,      secondary: RISK.low.secondary      },
        info:     { DEFAULT: RISK.neutral.DEFAULT,  secondary: RISK.neutral.secondary  },
        success:  { DEFAULT: RISK.healthy.DEFAULT,  secondary: RISK.healthy.secondary  },

        risk: {
          healthy:         RISK.healthy.DEFAULT,
          'healthy-soft':  RISK.healthy.secondary,
          low:             RISK.low.DEFAULT,
          'low-soft':      RISK.low.secondary,
          medium:          RISK.medium.DEFAULT,
          'medium-soft':   RISK.medium.secondary,
          high:            RISK.high.DEFAULT,
          'high-soft':     RISK.high.secondary,
          critical:        RISK.critical.DEFAULT,
          'critical-soft': RISK.critical.secondary,
          neutral:         RISK.neutral.DEFAULT,
          'neutral-soft':  RISK.neutral.secondary,
        },

        surface: {
          base:     SURFACE.base,
          sunken:   SURFACE.sunken,
          muted:    SURFACE.muted,
          elevated: SURFACE.elevated,
          raised:   SURFACE.raised,
          overlay:  SURFACE.overlay,
        },

        border: {
          subtle:  BORDER.subtle,
          DEFAULT: BORDER.default,
          strong:  BORDER.strong,
          focus:   BORDER.focus,
        },

        ink: {
          strong:      TEXT.strong,
          primary:     TEXT.primary,
          secondary:   TEXT.secondary,
          tertiary:    TEXT.tertiary,
          muted:       TEXT.muted,
          disabled:    TEXT.disabled,
          'on-accent': TEXT.onAccent,
        },

        chart: {
          primary:   CHART.primary,
          secondary: CHART.secondary,
          tertiary:  CHART.tertiary,
          accent:    CHART.accent,
          success:   CHART.success,
          warning:   CHART.warning,
          indigo:    CHART.indigo,
          muted:     CHART.muted,
          grid:      CHART.grid,
        },

        // Admin-only operator chrome — dense rows, sticky headers, etc.
        // These do NOT exist in the customer app.
        operator: {
          'rail':       '#0f1535', // deep navy for the left rail
          'rail-hover': '#1a2150',
          'rail-line':  '#212a5e',
          'row-alt':    '#fafbff', // zebra striping for high-density tables
        },
      },
      boxShadow: {
        'card':       '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 1px rgba(15, 23, 42, 0.03)',
        'card-hover': '0 4px 10px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.04)',
        'pop':        '0 8px 24px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};
