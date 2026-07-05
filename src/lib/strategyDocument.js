import { jsPDF } from 'jspdf';
import { DEMO_STRATEGY_LIBRARY, DEMO_STRATEGY_STATS } from '@/lib/demoData';

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
    doc.text(`Category: ${s.category}  |  Status: ${s.status}  |  Risk: ${s.riskProfile}`, margin, y);
    y += 7;
    addDivider();

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

    // Performance stats
    if (stats) {
      addWrappedText('PERFORMANCE METRICS', 11, 'bold', [50, 50, 50]);
      y += 2;
      const metrics = [
        `Total Signals: ${stats.totalSignals}`,
        `Total Paper Orders: ${stats.totalPaperOrders}`,
        `Wins: ${stats.wins}  |  Losses: ${stats.losses}`,
        `Strike Rate: ${stats.strikeRate.toFixed(1)}%`,
        `Gross Profit: $${stats.grossProfit.toFixed(2)}`,
        `Net Profit: $${stats.netProfit.toFixed(2)}`,
        `ROI: ${stats.roi.toFixed(1)}%`,
        `Profit Factor: ${stats.profitFactor.toFixed(2)}`,
        `Max Drawdown: $${stats.maxDrawdown.toFixed(2)}`,
        `Longest Losing Streak: ${stats.longestLosingStreak}`,
        `Average Odds: ${stats.averageOdds.toFixed(2)}`,
        `Average Stake: $${stats.averageStake.toFixed(2)}`,
        `Average Edge: ${stats.averageEdge.toFixed(1)}%`,
        `Closing Line Value: ${stats.closingLineValue.toFixed(1)}%`,
        `Status: ${stats.statusLabel}`,
      ];
      metrics.forEach((m) => {
        addWrappedText(`  • ${m}`, 10, 'normal', [40, 40, 40]);
      });
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