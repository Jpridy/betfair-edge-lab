import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs', '@radix-ui/react-switch', '@radix-ui/react-tooltip', '@radix-ui/react-dropdown-menu', '@radix-ui/react-popover', '@radix-ui/react-checkbox', '@radix-ui/react-label', '@radix-ui/react-separator', '@radix-ui/react-scroll-area'],
          'vendor-utils': ['lodash', 'moment', 'date-fns', 'clsx', 'tailwind-merge'],
          'vendor-dnd': ['@hello-pangea/dnd'],
          'vendor-markdown': ['react-markdown'],
        },
      },
    },
  },
});