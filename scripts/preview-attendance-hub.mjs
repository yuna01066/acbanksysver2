// Isolated UI fixture: Supabase and auth imports are replaced before loading application code.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  configFile: false, root, appType: 'custom',
  resolve: { alias: { '@': root + 'src' }, dedupe: ['react', 'react-dom'] },
  plugins: [{
    name: 'isolated-attendance-fixture', enforce: 'pre',
    resolveId(id) {
      if (id === 'hub-preview') return '\0hub-preview';
      if (id.endsWith('/contexts/AuthContext') || id.endsWith('/contexts/AuthContext.tsx')) return '\0hub-auth';
      if (id.endsWith('/integrations/supabase/client') || id.endsWith('/integrations/supabase/client.ts')) return '\0hub-db';
    },
    load(id) {
      if (id === '\0hub-auth') return `
        export const useAuth = () => {
          const role = new URLSearchParams(location.search).get('role') || sessionStorage.getItem('qa-role') || 'admin';
          sessionStorage.setItem('qa-role', role);
          return { user: { id: role === 'employee' ? 'staff-1' : 'admin-1', email: 'fixture@example.invalid' },
            profile: { full_name: role === 'employee' ? '테스트 직원' : '테스트 관리자', join_date: '2025-10-01' },
            isAdmin: role === 'admin', isModerator: role === 'moderator', loading: false };
        };
      `;
      if (id === '\0hub-db') {
        this.addWatchFile(root + 'tests/attendance-hub-fixture.js');
        return readFileSync(root + 'tests/attendance-hub-fixture.js', 'utf8');
      }
      if (id === '\0hub-preview') return `
        import React from 'react'; import { createRoot } from 'react-dom/client';
        import { BrowserRouter, Routes, Route } from 'react-router-dom';
        import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
        import { Toaster } from 'sonner';
        import Hub, { LeaveManagementRedirect } from '/src/pages/AttendanceHubPage.tsx';
        import '/src/index.css';
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider, {client},
          React.createElement(BrowserRouter, null,
            React.createElement('div', {className:'p-2 text-center text-xs bg-muted'}, '격리된 UI 테스트 · 운영 DB 미연결'),
            React.createElement(Routes, null,
              React.createElement(Route,{path:'/leave-management',element:React.createElement(LeaveManagementRedirect)}),
              React.createElement(Route,{path:'*',element:React.createElement(Hub)})),
            React.createElement(Toaster))));
      `;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!['/', '/attendance', '/leave-management'].includes(req.url.split('?')[0])) return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(await server.transformIndexHtml(req.url, '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>근태 통합 격리 검증</title></head><body><div id="root"></div><script type="module" src="/@id/__x00__hub-preview"></script></body></html>'));
      });
    },
  }, react()],
  server: { host: '127.0.0.1', port: 4179, strictPort: true },
});
await server.listen(); server.printUrls();
