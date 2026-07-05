import { jsPDF } from 'jspdf';
import { DEMO_STRATEGY_LIBRARY, DEMO_STRATEGY_STATS } from '@/lib/demoData';
import { getAuditData } from '@/lib/strategyAuditData';
import { computeTrafficLight, computeDataQuality, checkLiveLockout, getPaperProgress, reconcileMetrics } from '@/lib/strategyValidation';

export function generateStrategyDocument() {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addWrappedText = (text, fontSize, fontStyle = 'normal', color = [30, 30, 30]) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', fontStyle);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line) => {
      ensureSpace(fontSize * 0.5 + 2);
      doc.text(line, margin, y);
      y += fontSize * 0.5 + 2;
    });
  };

  const addDivider = () => {
    ensureSpace(6);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  // Title page
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Betfair Edge Lab', margin, y);
  y += 12;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Strategy Reference Document', margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString('en-AU')}`, margin, y);
  y += 6;
  doc.text(`Total Strategies: ${DEMO_STRATEGY_LIBRARY.length}`, margin, y);
  y += 10;
  addDivider();

  addWrappedText(
    'This document provides a comprehensive breakdown of every trading strategy available in the Betfair Edge Lab platform. Each strategy is explained in full detail, including its core logic, entry rules, exit rules, risk profile, applicable market types, time windows, and current performance metrics.',
    10,
    'normal',
    [60, 60, 60]
  );
  y += 4;
  addWrappedText(
    'All strategies operate on the Betfair Exchange (Australian jurisdiction) and adhere to the Betfair tick ladder, standard 5% commission rate, and exchange market ID formats.',
    10,
    'normal',
    [60, 60, 60]
  );
  y += 6;

  // Table of contents
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Contents', margin, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  DEMO_STRATEGY_LIBRARY.forEach((s, i) => {
    ensureSpace(5);
    doc.text(`${i + 1}. ${s.name} (${s.category})`, margin, y);
    y += 5;
  });
  y += 4;
  addDivider();

  // Each strategy
  DEMO_STRATEGY_LIBRARY.forEach((s, index) => {
    if (index > 0) {
      doc.addPage();
      y = margin;
    }

    const stats = DEMO_STRATEGY_STATS.find((st) => st.strategyName === s.name);
    const audit = getAuditData(s.name);
    const trafficLight = computeTrafficLight(s, audit, { bankroll: 10000 });
    const dq = computeDataQuality(s, audit);
    const progress = getPaperProgress(audit);
    const recon = reconcileMetrics(audit);
    const lockout = checkLiveLockout(s, audit, { bankroll: 10000 }, { liveApproved: false, userConfirmed: false });

    // Strategy header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    ensureSpace(10);
    doc.text(`${index + 1}. ${s.name}`, margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const lightColor = trafficLight.light === 'green' ? [0, 128, 0] : trafficLight.light === 'yellow' ? [200, 150, 0] : trafficLight.light === 'red' ? [200, 0, 0] : [128, 128, 128];
    doc.text(`Category: ${s.category}  |  Risk: ${s.riskProfile}`, margin, y);
    y += 5;
    doc.setTextColor(...lightColor);
    doc.text(`Status: ${trafficLight.label.toUpperCase()}`, margin, y);
    y += 5;
    doc.setTextColor(100, 100, 100);
    doc.text(`Data Quality: ${dq.label}  |  Live Mode: ${lockout.locked ? 'LOCKED' : 'AVAILABLE'}`, margin, y);
    y += 7;
    addDivider();

    // Validation summary
    addWrappedText('VALIDATION STATUS', 11, 'bold', [50, 50, 50]);
    y += 2;
    addWrappedText(`Paper Progress: ${progress.current} / ${progress.target} settled trades (${progress.percent.toFixed(0)}%)`, 10, 'normal', [40, 40, 40]);
    if (lockout.locked) {
      addWrappedText('Live Mode Lockout Reasons:', 10, 'bold', [180, 0, 0]);
      lockout.reasons.forEach((r) => {
        addWrappedText(`  - ${r}`, 10, 'normal', [120, 0, 0]);
      });
    } else {
      addWrappedText('All live mode validation criteria passed.', 10, 'bold', [0, 128, 0]);
    }
    if (!recon.valid) {
      addWrappedText('Metric Reconciliation Warnings:', 10, 'bold', [180, 0, 0]);
      recon.errors.forEach((e) => {
        addWrappedText(`  - ${e}`, 10, 'normal', [120, 0, 0]);
      });
    }
    y += 3;

    // Description
    addWrappedText('OVERVIEW', 11, 'bold', [50, 50, 50]);
    y += 2;
    addWrappedText(s.description, 10, 'normal', [40, 40, 40]);
    y += 4;

    // Entry Rules
    addWrappedText('ENTRY RULES', 11, 'bold', [50, 50, 50]);
    y += 2;
    addWrappedText(s.entryRules, 10, 'normal', [40, 40, 40]);
    y += 4;

    // Exit Rules
    addWrappedText('EXIT RULES', 11, 'bold', [50, 50, 50]);
    y += 2;
    addWrappedText(s.exitRules, 10, 'normal', [40, 40, 40]);
    y += 4;

    // Parameters
    addWrappedText('PARAMETERS', 11, 'bold', [50, 50, 50]);
    y += 2;
    const params = [
      `Market Types: ${s.marketTypes.join(', ')}`,
      `Time Window: ${s.timeWindow}`,
      `Minimum Edge: ${s.minEdge.toFixed(1)}%`,
      `Minimum Liquidity: $${s.minLiquidity.toLocaleString()}`,
      `Risk Profile: ${s.riskProfile}`,
      `Created: ${new Date(s.createdAt).toLocaleDateString('en-AU')}`,
      `Last Run: ${new Date(s.lastRun).toLocaleDateString('en-AU')}`,
    ];
    params.forEach((p) => {
      addWrappedText(`  • ${p}`, 10, 'normal', [40, 40, 40]);
    });
    y += 3;

    // Full audit panel
    if (audit) {
      addWrappedText('FULL AUDIT PANEL', 11, 'bold', [50, 50, 50]);
      y += 2;
      const metrics = [
        `Total Signals: ${audit.totalSignals}`,
        `Total Paper Orders: ${audit.totalPaperOrders}`,
        `Matched Orders: ${audit.matchedOrders}`,
        `Unmatched Orders: ${audit.unmatchedOrders}`,
        `Wins: ${audit.wins}  |  Losses: ${audit.losses}`,
        `Strike Rate: ${audit.strikeRate.toFixed(1)}%`,
        `Total Stake: $${audit.totalStake.toFixed(2)}`,
        `Total Liability: $${audit.totalLiability.toFixed(2)}`,
        `Gross Profit: $${audit.grossProfit.toFixed(2)}`,
        `Commission Paid: $${audit.commissionPaid.toFixed(2)}`,
        `Net Profit: $${audit.netProfit.toFixed(2)}`,
        `ROI (stake-based): ${audit.roi.toFixed(2)}%`,
        `Liability ROI: ${audit.liabilityRoi.toFixed(2)}%`,
        `Profit Factor: ${audit.profitFactor.toFixed(2)}`,
        `Max Drawdown: $${audit.maxDrawdown.toFixed(2)}`,
        `Longest Losing Streak: ${audit.longestLosingStreak}`,
        `Average Odds: ${audit.averageOdds.toFixed(2)}`,
        `Average Stake: $${audit.averageStake.toFixed(2)}`,
        `Average Edge: ${audit.averageEdge.toFixed(1)}%`,
        `Average Matched Price: ${audit.averageMatchedPrice.toFixed(2)}`,
        `Closing Price: ${audit.closingPrice.toFixed(2)}`,
        `Closing Line Value: ${audit.closingLineValue.toFixed(1)}%`,
        `Slippage: ${audit.slippage.toFixed(2)}%`,
        `Avg Time Before Start: ${audit.averageTimeBeforeStart}s`,
        `Last Run: ${new Date(audit.lastRunDate).toLocaleDateString('en-AU')}`,
      ];
      metrics.forEach((m) => {
        addWrappedText(`  • ${m}`, 10, 'normal', [40, 40, 40]);
      });
      y += 2;
      addWrappedText(`ROI Formula: Net Profit / Total Stake x 100 = $${audit.netProfit.toFixed(2)} / $${audit.totalStake.toFixed(2)} x 100 = ${audit.roi.toFixed(2)}%`, 9, 'italic', [80, 80, 80]);
      if (audit.totalLiability !== audit.totalStake) {
        addWrappedText(`Liability ROI Formula: Net Profit / Total Liability x 100 = ${audit.liabilityRoi.toFixed(2)}%`, 9, 'italic', [80, 80, 80]);
      }
    }

    addDivider();
  });

  // Footer on all pages
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Betfair Edge Lab — Strategy Reference  |  Page ${i} of ${pageCount}`,
      margin,
      pageHeight - 10
    );
  }

  doc.save('betfair-edge-lab-strategies.pdf');
}