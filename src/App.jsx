import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import Layout from '@/components/Layout';
import DashboardHome from '@/pages/DashboardHome';
import MarketScanner from '@/pages/MarketScanner';
import RunnerView from '@/pages/RunnerView';
import StrategyLab from '@/pages/StrategyLab';
import PaperTrading from '@/pages/PaperTrading';
import Backtesting from '@/pages/Backtesting';
import Orders from '@/pages/Orders';
import RiskManager from '@/pages/RiskManager';
import Settings from '@/pages/Settings';
import LogsAudit from '@/pages/LogsAudit';
import BotControlCentre from '@/pages/BotControlCentre';
import { AppProvider } from '@/lib/AppContext';

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
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/bot-control" element={<BotControlCentre />} />
          <Route path="/scanner" element={<MarketScanner />} />
          <Route path="/runner" element={<RunnerView />} />
          <Route path="/strategy" element={<StrategyLab />} />
          <Route path="/paper-trading" element={<PaperTrading />} />
          <Route path="/backtesting" element={<Backtesting />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/risk" element={<RiskManager />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/logs" element={<LogsAudit />} />
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