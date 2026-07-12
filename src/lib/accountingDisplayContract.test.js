import{describe,expect,it}from'vitest';
import dashboard from'@/pages/Dashboard.jsx?raw';
import controls from'@/pages/Controls.jsx?raw';
import analytics from'@/pages/Analytics.jsx?raw';
import debug from'@/pages/Debug.jsx?raw';
import orders from'@/pages/Orders.jsx?raw';
import sidebar from'@/components/navigation/BankrollPanel.jsx?raw';
import risk from'@/components/controlroom/RiskOrdersPanel.jsx?raw';

describe('accounting display contract',()=>{
it('binds every financial surface to the authoritative accounting display',()=>{expect(dashboard).toContain('AccountingSummary');expect(controls).toContain('AccountingSummary');expect(analytics).toContain('AccountingSummary');expect(debug).toContain('AccountingSummary');expect(orders).toContain('usePortfolioAccountingDisplay');expect(sidebar).toContain('usePortfolioAccountingDisplay');expect(risk).toContain('usePortfolioAccountingDisplay');});
it('keeps order gross, commission and net columns separate',()=>{expect(orders).toContain('Gross Result');expect(orders).toContain('Commission');expect(orders).toContain('Net Result');expect(orders).not.toContain('o.netProfit || o.grossProfit');});
});