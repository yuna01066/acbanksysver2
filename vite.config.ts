import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@tanstack/react-query',
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/extension-underline',
      '@tiptap/extension-text-align',
      '@tiptap/extension-table',
      '@tiptap/extension-table-row',
      '@tiptap/extension-table-cell',
      '@tiptap/extension-table-header',
      '@tiptap/extension-placeholder',
      '@tiptap/extension-color',
      '@tiptap/extension-text-style',
      '@tiptap/extension-highlight',
      '@tiptap/extension-horizontal-rule',
      '@tiptap/extension-mention',
      '@tiptap/suggestion',
    ],
    force: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router-dom/') || id.includes('/@tanstack/react-query/')) {
            return 'vendor-react';
          }
          if (id.includes('/@supabase/')) {
            return 'vendor-supabase';
          }
          if (id.includes('/@radix-ui/') || id.includes('/lucide-react/') || id.includes('/cmdk/') || id.includes('/vaul/')) {
            return 'vendor-ui';
          }
          if (id.includes('/@tiptap/') || id.includes('/prosemirror-') || id.includes('/orderedmap/')) {
            return 'vendor-editor';
          }
          if (id.includes('/recharts/')) {
            return 'vendor-charts';
          }
          if (id.includes('/date-fns/') || id.includes('/react-day-picker/')) {
            return 'vendor-date';
          }
          if (id.includes('/html2canvas/')) {
            return 'vendor-html2canvas';
          }
          if (id.includes('/xlsx/')) {
            return 'vendor-xlsx';
          }
          if (id.includes('/react-hook-form/') || id.includes('/@hookform/') || id.includes('/zod/')) {
            return 'vendor-forms';
          }
          if (id.includes('/@dnd-kit/') || id.includes('/react-resizable-panels/') || id.includes('/embla-carousel-react/')) {
            return 'vendor-interactions';
          }
          if (id.includes('/@floating-ui/')) {
            return 'vendor-floating';
          }
          return undefined;
        },
      },
    },
  },
}));
