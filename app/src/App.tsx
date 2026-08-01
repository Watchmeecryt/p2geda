import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { LandingPage } from '@/pages/LandingPage';
import { PoolPage } from '@/pages/PoolPage';
import { DrawsPage } from '@/pages/DrawsPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { MetricsPage } from '@/pages/MetricsPage';
import { AdminPage } from '@/pages/AdminPage';
import { YieldPage } from '@/pages/YieldPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/app/*"
          element={
            <AppShell>
              <Routes>
                <Route index element={<PoolPage />} />
                <Route path="draws" element={<DrawsPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="metrics" element={<MetricsPage />} />
                <Route path="yield" element={<YieldPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="*" element={<Navigate to="/app" replace />} />
              </Routes>
            </AppShell>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
