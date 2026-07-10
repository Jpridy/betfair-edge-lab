import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Eager imports — auth pages and layout must load immediately
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AppProvider } from '@/lib/AppContext';
import { RaceDayProvider } from '@/lib/RaceDayContext';

// Five focused product pages
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Controls = lazy(() => import('@/pages/Controls'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Settings = lazy(() => import('@/pages/Settings'));
const Debug = lazy(() => import('@/pages/Debug'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <AppProvider>
      <RaceDayProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
            <Route path="/controls" element={<Suspense fallback={<PageLoader />}><Controls /></Suspense>} />
            <Route path="/analytics" element={<Suspense fallback={<PageLoader />}><Analytics /></Suspense>} />
            <Route path="/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
            <Route path="/debug" element={<Suspense fallback={<PageLoader />}><Debug /></Suspense>} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/setup-wizard" element={<Navigate to="/controls" replace />} />
            <Route path="/risk" element={<Navigate to="/controls" replace />} />
            <Route path="/scanner" element={<Navigate to="/debug" replace />} />
            <Route path="/runner" element={<Navigate to="/debug" replace />} />
            <Route path="/exchange-opportunities" element={<Navigate to="/" replace />} />
            <Route path="/paper-trading" element={<Navigate to="/analytics" replace />} />
            <Route path="/performance-analytics" element={<Navigate to="/analytics" replace />} />
            <Route path="/orders" element={<Navigate to="/analytics" replace />} />
            <Route path="/strategy" element={<Navigate to="/settings" replace />} />
            <Route path="/strategy-library" element={<Navigate to="/analytics" replace />} />
            <Route path="/strategy/:id" element={<Navigate to="/analytics" replace />} />
            <Route path="/backtesting" element={<Navigate to="/debug" replace />} />
            <Route path="/logs" element={<Navigate to="/debug" replace />} />
            <Route path="/wiring-audit" element={<Navigate to="/debug" replace />} />
            <Route path="/mock-featherless" element={<Navigate to="/debug" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      </RaceDayProvider>
    </AppProvider>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App