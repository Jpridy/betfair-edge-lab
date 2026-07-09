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
import BotControlCentre from '@/pages/BotControlCentre';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AppProvider } from '@/lib/AppContext';

// Lazy-loaded pages — reduces initial bundle size
const DashboardHome = lazy(() => import('@/pages/DashboardHome'));
const SetupWizard = lazy(() => import('@/pages/SetupWizard'));
const MarketScanner = lazy(() => import('@/pages/MarketScanner'));
const PaperTrading = lazy(() => import('@/pages/PaperTrading'));
const PerformanceAnalytics = lazy(() => import('@/pages/PerformanceAnalytics'));
const Settings = lazy(() => import('@/pages/Settings'));

// Admin/Advanced pages — lazy loaded, not in main sidebar
const RunnerView = lazy(() => import('@/pages/RunnerView'));
const StrategyLab = lazy(() => import('@/pages/StrategyLab'));
const Backtesting = lazy(() => import('@/pages/Backtesting'));
const Orders = lazy(() => import('@/pages/Orders'));
const RiskManager = lazy(() => import('@/pages/RiskManager'));
const LogsAudit = lazy(() => import('@/pages/LogsAudit'));
const StrategyLibrary = lazy(() => import('@/pages/StrategyLibrary'));
const StrategyDetail = lazy(() => import('@/pages/StrategyDetail'));
const ExchangeOpportunities = lazy(() => import('@/pages/ExchangeOpportunities'));
const WiringAudit = lazy(() => import('@/pages/WiringAudit'));

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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<Layout />}>
            <Route path="/" element={<BotControlCentre />} />
            <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><DashboardHome /></Suspense>} />
            <Route path="/setup-wizard" element={<Suspense fallback={<PageLoader />}><SetupWizard /></Suspense>} />
            <Route path="/scanner" element={<Suspense fallback={<PageLoader />}><MarketScanner /></Suspense>} />
            <Route path="/paper-trading" element={<Suspense fallback={<PageLoader />}><PaperTrading /></Suspense>} />
            <Route path="/performance-analytics" element={<Suspense fallback={<PageLoader />}><PerformanceAnalytics /></Suspense>} />
            <Route path="/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
            {/* Admin/Advanced pages — accessible but not in main sidebar */}
            <Route path="/runner" element={<Suspense fallback={<PageLoader />}><RunnerView /></Suspense>} />
            <Route path="/strategy" element={<Suspense fallback={<PageLoader />}><StrategyLab /></Suspense>} />
            <Route path="/backtesting" element={<Suspense fallback={<PageLoader />}><Backtesting /></Suspense>} />
            <Route path="/orders" element={<Suspense fallback={<PageLoader />}><Orders /></Suspense>} />
            <Route path="/risk" element={<Suspense fallback={<PageLoader />}><RiskManager /></Suspense>} />
            <Route path="/logs" element={<Suspense fallback={<PageLoader />}><LogsAudit /></Suspense>} />
            <Route path="/strategy-library" element={<Suspense fallback={<PageLoader />}><StrategyLibrary /></Suspense>} />
            <Route path="/strategy/:id" element={<Suspense fallback={<PageLoader />}><StrategyDetail /></Suspense>} />
            <Route path="/exchange-opportunities" element={<Suspense fallback={<PageLoader />}><ExchangeOpportunities /></Suspense>} />
            <Route path="/wiring-audit" element={<Suspense fallback={<PageLoader />}><WiringAudit /></Suspense>} />
          </Route>
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
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