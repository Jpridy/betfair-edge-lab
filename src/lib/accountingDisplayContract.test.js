import { describe, expect, it } from 'vitest';
import dashboard from '@/pages/Dashboard.jsx?raw';
import controls from '@/pages/Controls.jsx?raw';
import analytics from '@/pages/Analytics.jsx?raw';
import debug from '@/pages/Debug.jsx?raw';
import orders from '@/pages/Orders.jsx?raw';
import mainMoneyRow from '@/components/dashboard/MainMoneyRow.jsx?raw';
import analyticsOverview from '@/components/analytics/AnalyticsOverview.jsx?raw';
import debugAccounting from '@/components/debug/DebugAccounting.jsx?raw';
import sidebar from '@/components/navigation/BankrollPanel.jsx?raw';
import risk from '@/components/controlroom/RiskOrdersPanel.jsx?raw';

describe('accounting display contract', () => {
  it('binds every financial surface to the authoritative accounting display', () => {
    expect(dashboard).toContain('MainMoneyRow');
    expect(mainMoneyRow).toContain('usePortfolioAccountingDisplay');
    expect(controls).toContain('AccountingSummary');
    expect(analytics).toContain('AnalyticsOverview');
    expect(analyticsOverview).toContain('usePortfolioAccountingDisplay');
    expect(debug).toContain('DebugAccounting');
    expect(debugAccounting).toContain('usePortfolioAccountingDisplay');
    expect(orders).toContain('usePortfolioAccountingDisplay');
    expect(sidebar).toContain('usePortfolioAccountingDisplay');
    expect(risk).toContain('usePortfolioAccountingDisplay');
  });

  it('keeps order gross, commission and net columns separate', () => {
    expect(orders).toContain('Gross Result');
    expect(orders).toContain('Commission');
    expect(orders).toContain('Net Result');
    expect(orders).not.toContain('o.netProfit || o.grossProfit');
  });

  it('keeps dashboard P/L, equity and exposure as separate authoritative values', () => {
    expect(mainMoneyRow).toContain('accounting.netRealisedPL');
    expect(mainMoneyRow).toContain('accounting.currentEquity');
    expect(mainMoneyRow).toContain('accounting.totalOpenExposure');
    expect(mainMoneyRow).toContain('accounting.availableBankroll');
  });
});
