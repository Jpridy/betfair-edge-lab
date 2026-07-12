import { isValidTickPrice } from './tickLadder';
import { detectMarketType, resolveNumberOfWinners } from './marketClusterer';

const selectionIdOf = runner => String(runner?.normalizedSelectionId || runner?.betfairSelectionId || runner?.selectionId || '').trim();

export function validateCompleteMarketBook(runners = [], marketOrThreshold = {}, normalizedThreshold = 150) {
  const market=typeof marketOrThreshold === 'object' ? marketOrThreshold : {};
  const threshold=typeof marketOrThreshold === 'number' ? marketOrThreshold : normalizedThreshold;
  const active=runners.filter(runner => runner?.status === 'ACTIVE');
  const ids=new Set(), objectRefs=new Set(), errors=[];
  let rawBackBookPercentage=0,rawLayBookPercentage=0,pricedRunnerCount=0;
  for (const runner of active) {
    const selectionId=selectionIdOf(runner);
    if (!selectionId || ids.has(selectionId)) errors.push('DUPLICATE_SELECTION_ID');
    ids.add(selectionId);
    const priceSignatures=new Set();
    for (const [side,ladder] of [['BACK',runner.availableToBack || runner.availableToBackLadder || []],['LAY',runner.availableToLay || runner.availableToLayLadder || []]]) for (const priceObject of ladder) if (priceObject && typeof priceObject === 'object') {
      if (objectRefs.has(priceObject)) errors.push('DUPLICATED_PRICE_OBJECT'); objectRefs.add(priceObject);
      const signature=`${side}:${Number(priceObject.price)}:${Number(priceObject.size)}`; if (priceSignatures.has(signature)) errors.push('DUPLICATED_PRICE_OBJECT'); priceSignatures.add(signature);
    }
    const back=Number(runner.bestBackPrice || 0), lay=Number(runner.bestLayPrice || 0);
    if (!(back>0) || !(lay>0)) errors.push(`MISSING_RUNNER_PRICES:${selectionId}`);
    if (back>0 && !isValidTickPrice(back)) errors.push(`INVALID_BACK_TICK:${selectionId}`);
    if (lay>0 && !isValidTickPrice(lay)) errors.push(`INVALID_LAY_TICK:${selectionId}`);
    if (back>0) rawBackBookPercentage+=100/back;
    if (lay>0) rawLayBookPercentage+=100/lay;
    if (back>0 || lay>0) pricedRunnerCount++;
  }
  const marketType=detectMarketType(market);
  const resolved=resolveNumberOfWinners(market);
  const numberOfWinners=marketType === 'PLACE' ? Math.max(1,Number(resolved.numberOfWinners)||1) : 1;
  const expectedBookPercentage=numberOfWinners*100;
  const normalizedBackBookPercentage=rawBackBookPercentage/numberOfWinners;
  const normalizedLayBookPercentage=rawLayBookPercentage/numberOfWinners;
  if (active.length<2 || pricedRunnerCount<2) errors.push('INSUFFICIENT_PRICED_RUNNERS');
  if (normalizedBackBookPercentage>threshold) errors.push(`BACK_BOOK_ABOVE_MAX:${normalizedBackBookPercentage.toFixed(2)}`);
  return {valid:errors.length===0,errors:[...new Set(errors)],activeRunnerCount:active.length,pricedRunnerCount,rawBackBookPercentage,rawLayBookPercentage,backBookPercentage:rawBackBookPercentage,layBookPercentage:rawLayBookPercentage,numberOfWinners,expectedBookPercentage,normalizedBackBookPercentage,normalizedLayBookPercentage,validationThresholdUsed:threshold};
}