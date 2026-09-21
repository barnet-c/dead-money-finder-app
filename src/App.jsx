import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster as SonnerToaster } from 'sonner';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import Layout from '@/pages/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Customers from '@/pages/Customers';
import Recovery from '@/pages/Recovery';
import ReminderLog from '@/pages/ReminderLog';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import Onboarding from '@/pages/Onboarding';
import PageNotFound from '@/pages/PageNotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
  },
});

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen bg-background paper-texture grid place-items-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground animate-pulse">Opening the journal…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/recovery" element={<Recovery />} />
              <Route path="/reminders" element={<ReminderLog />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<PageNotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <SonnerToaster
          position="top-right"
          richColors
          toastOptions={{ style: { borderRadius: '2px', fontFamily: 'var(--font-sans)', fontSize: '13px' } }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
