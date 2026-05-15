import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const getVendorChunk = (id: string) => {
  const normalizedId = id.split(path.sep).join('/');
  if (!normalizedId.includes('/node_modules/')) return undefined;

  if (
    normalizedId.includes('/react/') ||
    normalizedId.includes('/react-dom/') ||
    normalizedId.includes('/scheduler/')
  ) {
    return 'vendor-react';
  }
  if (normalizedId.includes('/@supabase/')) return 'vendor-supabase';
  if (normalizedId.includes('/@tanstack/')) return 'vendor-query';
  if (
    normalizedId.includes('/@radix-ui/') ||
    normalizedId.includes('/lucide-react/')
  ) {
    return 'vendor-ui';
  }
  if (
    normalizedId.includes('/@tiptap/') ||
    normalizedId.includes('/prosemirror-')
  ) {
    return 'vendor-editor';
  }
  if (
    normalizedId.includes('/recharts/') ||
    normalizedId.includes('/d3-')
  ) {
    return 'vendor-charts';
  }
  if (
    normalizedId.includes('/html2canvas/') ||
    normalizedId.includes('/jspdf/')
  ) {
    return 'vendor-pdf';
  }
  if (normalizedId.includes('/xlsx/')) return 'vendor-xlsx';
  if (normalizedId.includes('/date-fns/')) return 'vendor-date';

  return undefined;
};

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
        manualChunks: getVendorChunk,
      },
    },
  },
}));
