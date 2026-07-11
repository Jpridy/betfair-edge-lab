const idOf = item => String(item?.selectionId || '');

export function normalizeWinProbabilities(probabilities = []) {
  const usable = probabilities.filter(item => idOf(item) && Number.isFinite(Number(item.pWin)) && Number(item.pWin) >= 0);
  const total = usable.reduce((sum,item)=>sum+Number(item.pWin),0);
  if (!(total > 0)) return [];
  return usable.map(item=>({...item,pWin:Number(item.pWin)/total}));
}

export function validateWinProbabilityField(probabilities = [], tolerance = 1e-9) {
  const normalized = normalizeWinProbabilities(probabilities);
  const total = normalized.reduce((sum,item)=>sum+item.pWin,0);
  return { valid:normalized.length===probabilities.length && Math.abs(total-1)<=tolerance, probabilities:normalized, total };
}

export function estimatePlaceProbabilities(winProbabilities = [], numberOfWinners = 2) {
  const field = normalizeWinProbabilities(winProbabilities);
  const places = Math.max(1,Math.min(Math.floor(numberOfWinners),field.length));
  const totals = new Map(field.map(item=>[idOf(item),0]));
  const walk = (remaining, depth, mass) => {
    if (depth >= places || !remaining.length) return;
    const denominator = remaining.reduce((sum,item)=>sum+item.pWin,0);
    if (!(denominator > 0)) return;
    for (let i=0;i<remaining.length;i++) {
      const item=remaining[i];
      const branch=mass*(item.pWin/denominator);
      totals.set(idOf(item),totals.get(idOf(item))+branch);
      walk([...remaining.slice(0,i),...remaining.slice(i+1)],depth+1,branch);
    }
  };
  walk(field,0,1);
  return field.map(item=>({...item,pPlace:totals.get(idOf(item))}));
}

export function normalizeH2HProbabilities(entries = []) {
  const pairs=new Map();
  for (const entry of entries) {
    const a=idOf(entry), b=String(entry?.opponentSelectionId||'');
    const p=Number(entry?.pBeatsOpponent);
    if (!a||!b||a===b||!Number.isFinite(p)||p<0||p>1) return [];
    const key=[a,b].sort().join(':');
    const canonical=a<b?p:1-p;
    if (pairs.has(key)&&Math.abs(pairs.get(key).probability-canonical)>1e-9) return [];
    pairs.set(key,{marketId:String(entry.marketId||''),a:[a,b].sort()[0],b:[a,b].sort()[1],probability:canonical});
  }
  return [...pairs.values()].flatMap(pair=>[
    {marketId:pair.marketId,selectionId:pair.a,opponentSelectionId:pair.b,pBeatsOpponent:pair.probability},
    {marketId:pair.marketId,selectionId:pair.b,opponentSelectionId:pair.a,pBeatsOpponent:1-pair.probability},
  ]);
}

export function buildProbabilityMap(probabilities = []) { return new Map(normalizeWinProbabilities(probabilities).map(item=>[idOf(item),{...item,pWin:item.pWin}])); }
export function buildH2HMap(probabilities = []) { return new Map(normalizeH2HProbabilities(probabilities).map(item=>[`${item.marketId}:${item.selectionId}`,item])); }