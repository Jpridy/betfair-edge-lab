import { isValidTickPrice } from './tickLadder';

const selectionIdOf = runner => String(runner?.normalizedSelectionId || runner?.betfairSelectionId || runner?.selectionId || '').trim();

export function validateCompleteMarketBook(runners = [], maxBackBookPercentage = 150) {
  const active = runners.filter(runner => runner?.status === 'ACTIVE');
  const ids = new Set();
  const objectRefs = new Set();
  const errors = [];
  let backBookPercentage = 0;
  let layBookPercentage = 0;
  let pricedRunnerCount = 0;

  for (const runner of active) {
    const selectionId = selectionIdOf(runner);
    if (!selectionId || ids.has(selectionId)) errors.push('DUPLICATE_SELECTION_ID');
    ids.add(selectionId);
    for (const priceObject of [...(runner.availableToBack || []), ...(runner.availableToLay || []), ...(runner.availableToBackLadder || []), ...(runner.availableToLayLadder || [])]) {
      if (priceObject && typeof priceObject === 'object') {
        if (objectRefs.has(priceObject)) errors.push('DUPLICATED_PRICE_OBJECT');
        objectRefs.add(priceObject);
      }
    }
    const back = Number(runner.bestBackPrice || 0);
    const lay = Number(runner.bestLayPrice || 0);
    if (back > 0 && !isValidTickPrice(back)) errors.push(`INVALID_BACK_TICK:${selectionId}`);
    if (lay > 0 && !isValidTickPrice(lay)) errors.push(`INVALID_LAY_TICK:${selectionId}`);
    if (back > 0) backBookPercentage += 100 / back;
    if (lay > 0) layBookPercentage += 100 / lay;
    if (back > 0 || lay > 0) pricedRunnerCount++;
  }
  if (active.length < 2 || pricedRunnerCount < 2) errors.push('INSUFFICIENT_PRICED_RUNNERS');
  if (backBookPercentage > maxBackBookPercentage) errors.push(`BACK_BOOK_ABOVE_MAX:${backBookPercentage.toFixed(2)}`);
  return { valid: errors.length === 0, errors: [...new Set(errors)], activeRunnerCount: active.length, pricedRunnerCount, backBookPercentage, layBookPercentage };
}