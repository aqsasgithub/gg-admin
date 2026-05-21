import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Admin app runs on its own origin (e.g. admin.guardiangaze.com) and talks
// to the same Laravel backend as the customer app. The backend's
// EnsureAdminOrigin middleware verifies the Origin/Referer header, so
// during local dev the port must be stable.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
  },
  preview: {
    port: 5174,
    strictPort: true,
  },
});
