import { createClientFromRequest } from 'npm:@base44/sdk@0.8.37';

// ============================================================================
// openAIWebSearch — OpenAI Responses API with web_search tool
//
// Searches the public web for Australian horse racing information and returns
// a structured externalSearchResult object with:
//   - sources (with title, url, domain, extractedFacts)
//   - runnerResearch (positive/negative/neutral signals, probability adjustment)
//   - raceLevelNotes
//   - dataQuality
//
// This function does NOT place bets. It only provides external evidence that
// the exchange opportunity engine uses to adjust probabilities (clamped).
// The exchange engine remains the final authority for BET/NO_BET decisions.
// ============================================================================

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { market, runners, settings, action } = body;

    const base44 = createClientFromRequest(req);
    let user;
    try { user = await base44.auth.me(); } catch (_) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    // ── Status check action — verifies API key presence without making a search call ──
    if (action === 'status_check') {
      const apiKey = Deno.env.get('OPENAI_API_KEY');
      return Response.json({
        statusCheck: {
          openAiApiKeyPresent: !!apiKey,
          webSearchAvailable: !!apiKey,
          model: 'gpt-4o-mini',
          lastError: null,
          checkedAt: new Date().toISOString(),
        }
      }, { status: 200 });
    }

    // ── Result lookup action — searches the web for official race results ──
    // Used by the settlement watcher to backfill results for awaiting_result orders.
    // Does NOT create bets. Only returns result data for settlement.
    if (action === 'result_lookup') {
      return await handleResultLookup(body, req);
    }

    if (!market) return Response.json({ error: 'market is required' }, { status: 400 });

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return Response.json({
        externalSearchResult: {
          eventId: market.eventId || '',
          eventName: market.eventName || '',
          marketStartTime: market.startTime || market.marketStartTime || '',
          searchStatus: 'error',
          searchProvider: 'openai_web_search',
          searchQuery: '',
          searchedAt: new Date().toISOString(),
          sourceCount: 0,
          sources: [],
          runnerResearch: [],
          raceLevelNotes: '',
          dataQuality: 0,
          errorMessage: 'OPENAI_API_KEY not set',
        }
      }, { status: 200 });
    }

    const venue = market.venue || '';
    const raceNumber = market.raceNumber || '';
    const startTime = market.startTime || market.marketStartTime || '';
    const marketName = market.marketName || '';
    const eventName = market.eventName || '';
    const maxAdjustment = settings?.maxExternalProbabilityAdjustment ?? 0.05;

    // Detect country from event name or market country field — don't assume AU
    const countryRaw = (market.country || '').toUpperCase();
    const isNZ = countryRaw === 'NZ' || countryRaw === 'NZL' || /NZL|\(NZ\)|New Zealand/i.test(eventName);
    const regionLabel = isNZ ? 'New Zealand' : 'Australian';

    const activeRunners = (runners || [])
      .filter((r) => r.status === 'ACTIVE' && r.runnerName)
      .slice(0, 20);

    const dateStr = startTime
      ? new Date(startTime).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    const runnerList = activeRunners.map((r, i) => {
      const selId = String(r.betfairSelectionId || r.selectionId || i);
      return `${i + 1}. ${r.runnerName} (selectionId: ${selId})${r.horseNumber ? ' [#' + r.horseNumber + ']' : ''}`;
    }).join('\n');

    const searchQuery = `${regionLabel} horse racing ${venue} Race ${raceNumber} ${dateStr} ${activeRunners.map(r => r.runnerName).join(' ')} tips form track condition scratchings`.trim();

    const systemPrompt = `You are a horse racing research analyst for ${regionLabel} races. You search the web for current public race-day information and return it as structured JSON.

CRITICAL RULES:
1. Return ONLY valid JSON — no markdown, no code fences, no commentary.
2. For each runner, provide positive, negative, and neutral signals based on PUBLIC information found via web search.
3. Suggest a probabilityAdjustment for each runner: a decimal between -${maxAdjustment} and +${maxAdjustment}.
   - Positive adjustment = external evidence suggests the runner is MORE likely to win/place.
   - Negative adjustment = external evidence suggests the runner is LESS likely.
   - 0.0 = no strong external evidence either way.
4. NEVER suggest an adjustment larger than ±${maxAdjustment}. Keep adjustments conservative.
5. Only suggest a non-zero adjustment if you found actual evidence from web sources.
6. If you cannot find information about a runner, set probabilityAdjustment to 0.0 and note "insufficient external data".
7. confidenceAdjustment is a number between -20 and +20 (on a 0-100 scale).
8. Each runner's sourceUrls must be real URLs from the web search results.`;

    const userPrompt = `Research this ${regionLabel} horse race using web search:

Event: ${eventName}
Venue: ${venue}
Race number: ${raceNumber}
Race type: ${marketName}
Start time: ${startTime}
Date: ${dateStr}

Runners:
${runnerList}

Search the web for:
- Race fields and final declarations
- Scratchings / non-runners
- Runner form (recent starts, wins, places, last 5 starts)
- Track condition (e.g. Good 4, Soft 5, Heavy 8)
- Weather impact on the track
- Trainer and jockey information (strike rates, recent form)
- Recent results at this track
- Public tips and previews
- Market news (favourite moves, drifters)
- Gear changes (blinkers, tongue tie, etc.)
- Barrier / draw information
- Class changes
- Any other relevant race-day information

Return ONLY this JSON structure:
{
  "raceLevelNotes": "Brief summary of track condition, weather, race pattern, scratchings",
  "dataQuality": 0-100,
  "sources": [
    {
      "title": "Page title",
      "url": "https://...",
      "domain": "example.com",
      "publishedAt": "2024-01-01 or empty string",
      "relevance": "high|medium|low",
      "extractedFacts": ["fact 1", "fact 2"]
    }
  ],
  "runnerResearch": [
    {
      "selectionId": "the selectionId from the runner list above",
      "runnerName": "Runner Name",
      "positiveSignals": ["e.g. Strong recent form, 2 wins from last 3 starts"],
      "negativeSignals": ["e.g. Poor barrier draw, unproven on soft track"],
      "neutralSignals": ["e.g. Trainer has average strike rate at this venue"],
      "confidenceAdjustment": 0,
      "probabilityAdjustment": 0.0,
      "sourceUrls": ["https://..."]
    }
  ]
}`;

    const requestStart = Date.now();

    let resp;
    try {
      resp = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          instructions: systemPrompt,
          input: userPrompt,
          tools: [{
            type: 'web_search',
            search_context_size: 'medium',
            user_location: { type: 'approximate', country: 'AU' },
          }],
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (fetchErr) {
      const isTimeout = fetchErr.name === 'TimeoutError' || fetchErr.message?.includes('timeout');
      return Response.json({
        externalSearchResult: {
          eventId: market.eventId || '',
          eventName,
          marketStartTime: startTime,
          searchStatus: isTimeout ? 'timeout' : 'error',
          searchProvider: 'openai_web_search',
          searchQuery,
          searchedAt: new Date().toISOString(),
          sourceCount: 0,
          sources: [],
          runnerResearch: [],
          raceLevelNotes: '',
          dataQuality: 0,
          errorMessage: isTimeout ? 'OpenAI web search timed out after 60s' : fetchErr.message,
        }
      }, { status: 200 });
    }

    const responseTimeMs = Date.now() - requestStart;

    if (!resp.ok) {
      const errText = await resp.text();
      let errMessage = `OpenAI API error ${resp.status}`;
      try { const errJson = JSON.parse(errText); errMessage = errJson.error?.message || errMessage; } catch (_) {}
      return Response.json({
        externalSearchResult: {
          eventId: market.eventId || '',
          eventName,
          marketStartTime: startTime,
          searchStatus: 'error',
          searchProvider: 'openai_web_search',
          searchQuery,
          searchedAt: new Date().toISOString(),
          sourceCount: 0,
          sources: [],
          runnerResearch: [],
          raceLevelNotes: '',
          dataQuality: 0,
          errorMessage: errMessage,
        }
      }, { status: 200 });
    }

    const data = await resp.json();

    // Extract output text and URL citations
    let outputText = data.output_text || '';
    const extractedSources = [];

    for (const item of data.output || []) {
      if (item.type === 'message') {
        for (const content of item.content || []) {
          if (content.type === 'output_text') {
            outputText += content.text;
            for (const ann of content.annotations || []) {
              if (ann.type === 'url_citation' && ann.url) {
                let domain = '';
                try { domain = new URL(ann.url).hostname.replace('www.', ''); } catch (_) {}
                extractedSources.push({
                  title: ann.title || ann.url,
                  url: ann.url,
                  domain,
                  publishedAt: '',
                  relevance: 'medium',
                  extractedFacts: [],
                });
              }
            }
          }
        }
      }
    }

    if (!outputText) {
      return Response.json({
        externalSearchResult: {
          eventId: market.eventId || '',
          eventName,
          marketStartTime: startTime,
          searchStatus: 'no_results',
          searchProvider: 'openai_web_search',
          searchQuery,
          searchedAt: new Date().toISOString(),
          sourceCount: 0,
          sources: [],
          runnerResearch: [],
          raceLevelNotes: '',
          dataQuality: 0,
          errorMessage: 'OpenAI returned no output text',
        }
      }, { status: 200 });
    }

    // Parse JSON from the output — robust multi-strategy extraction
    // The model sometimes wraps JSON in conversational text or code fences,
    // and may include multiple { } blocks. We try several strategies.
    let parsed;
    const tryParse = (str) => { try { return JSON.parse(str); } catch (_) { return null; } };

    // Strategy 1: Strip code fences, try direct parse
    const cleaned = outputText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    parsed = tryParse(cleaned);

    // Strategy 2: Find all top-level { ... } blocks and try each (largest first)
    if (!parsed) {
      const blocks = [];
      let depth = 0, start = -1, inStr = false, esc = false;
      for (let i = 0; i < outputText.length; i++) {
        const ch = outputText[i];
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === '{') { if (depth === 0) start = i; depth++; }
        else if (ch === '}') { depth--; if (depth === 0 && start >= 0) { blocks.push(outputText.slice(start, i + 1)); start = -1; } }
      }
      blocks.sort((a, b) => b.length - a.length);
      for (const block of blocks) { parsed = tryParse(block); if (parsed) break; }
    }

    // Strategy 3: Greedy regex fallback
    if (!parsed) {
      const match = outputText.match(/\{[\s\S]*\}/);
      if (match) parsed = tryParse(match[0]);
    }

    if (!parsed) {
      return Response.json({
        externalSearchResult: {
          eventId: market.eventId || '',
          eventName,
          marketStartTime: startTime,
          searchStatus: 'error',
          searchProvider: 'openai_web_search',
          searchQuery,
          searchedAt: new Date().toISOString(),
          sourceCount: extractedSources.length,
          sources: extractedSources,
          runnerResearch: [],
          raceLevelNotes: '',
          dataQuality: 0,
          errorMessage: 'Failed to parse OpenAI response JSON',
          rawOutputSnippet: outputText.slice(0, 1000),
        }
      }, { status: 200 });
    }

    // Merge extracted URL citations with parsed sources
    const parsedSources = parsed.sources || [];
    const allSources = parsedSources.length > 0 ? parsedSources : extractedSources;

    // Clamp probability adjustments
    const clampedRunnerResearch = (parsed.runnerResearch || []).map(rr => ({
      selectionId: String(rr.selectionId || ''),
      runnerName: rr.runnerName || '',
      positiveSignals: Array.isArray(rr.positiveSignals) ? rr.positiveSignals : [],
      negativeSignals: Array.isArray(rr.negativeSignals) ? rr.negativeSignals : [],
      neutralSignals: Array.isArray(rr.neutralSignals) ? rr.neutralSignals : [],
      confidenceAdjustment: Math.max(-20, Math.min(20, Number(rr.confidenceAdjustment) || 0)),
      probabilityAdjustment: Math.max(-maxAdjustment, Math.min(maxAdjustment, Number(rr.probabilityAdjustment) || 0)),
      sourceUrls: Array.isArray(rr.sourceUrls) ? rr.sourceUrls : [],
    }));

    // Determine search status
    const sourceCount = allSources.length;
    const hasRunnerResearch = clampedRunnerResearch.length > 0;
    const searchStatus = sourceCount === 0 && !hasRunnerResearch ? 'no_results' : 'success';

    const externalSearchResult = {
      eventId: market.eventId || '',
      eventName,
      marketStartTime: startTime,
      searchStatus,
      searchProvider: 'openai_web_search',
      searchQuery,
      searchedAt: new Date().toISOString(),
      sourceCount,
      sources: allSources,
      runnerResearch: clampedRunnerResearch,
      raceLevelNotes: parsed.raceLevelNotes || '',
      dataQuality: Math.max(0, Math.min(100, Number(parsed.dataQuality) || (sourceCount > 0 ? 50 : 0))),
      errorMessage: null,
    };

    return Response.json({
      success: true,
      externalSearchResult,
      responseTimeMs,
      model: 'gpt-4o-mini',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ============================================================================
// Result Lookup Handler
//
// Searches the web for official race results to settle paper orders.
// Returns structured result data — never guesses, never uses random.
// ============================================================================
async function handleResultLookup(body, req) {
  const { eventName, marketName, marketStartTime, runnerName, selectionId, marketType, opponentSelectionId } = body;

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return Response.json({
      resultLookup: {
        resultLookupStatus: 'error',
        resultSource: 'openai_result_lookup',
        sourceUrls: [],
        winnerSelectionIds: [],
        placedSelectionIds: [],
        selectedRunnerFinishPosition: null,
        opponentFinishPosition: null,
        resultConfidence: 'unknown',
        voided: false,
        voidReason: null,
        errorMessage: 'OPENAI_API_KEY not set',
      }
    }, { status: 200 });
  }

  const dateStr = marketStartTime
    ? new Date(marketStartTime).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const searchQuery = `Australian horse racing result ${eventName} ${marketName} ${dateStr} ${runnerName} winner placed finishing position`.trim();

  const systemPrompt = `You are a horse racing results researcher. Search the web for official race results and return ONLY valid JSON. Never guess — if you cannot find results, say so explicitly.`;

  const userPrompt = `Search the web for the official result of this Australian horse race:

Event: ${eventName}
Market: ${marketName}
Race date/time: ${marketStartTime}
Date: ${dateStr}
Runner of interest: ${runnerName} (selectionId: ${selectionId})
Market type: ${marketType}
${opponentSelectionId ? `Opponent selectionId: ${opponentSelectionId}` : ''}

Find the official race result. I need:
1. Which horse WON the race
2. Finishing positions (1st, 2nd, 3rd etc.)
3. Whether ${runnerName} won/placed/lost

Return ONLY this JSON:
{
  "found": true/false,
  "winnerName": "name of winning horse or empty string",
  "winnerSelectionId": "selectionId of winner if known, or empty string",
  "placedRunners": [{"selectionId": "", "runnerName": "", "finishPosition": 1}],
  "selectedRunnerFinishPosition": number or null,
  "opponentFinishPosition": number or null,
  "confidence": "confirmed" | "probable" | "unknown",
  "sourceUrls": ["https://..."],
  "raceNotes": "brief summary of what was found"
}`;

  try {
    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        instructions: systemPrompt,
        input: userPrompt,
        tools: [{
          type: 'web_search',
          search_context_size: 'medium',
          user_location: { type: 'approximate', country: 'AU' },
        }],
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      let errMsg = `OpenAI API error ${resp.status}`;
      try { const errJson = JSON.parse(errText); errMsg = errJson.error?.message || errMsg; } catch (_) {}
      return Response.json({
        resultLookup: {
          resultLookupStatus: 'error',
          resultSource: 'openai_result_lookup',
          sourceUrls: [],
          winnerSelectionIds: [],
          placedSelectionIds: [],
          selectedRunnerFinishPosition: null,
          opponentFinishPosition: null,
          resultConfidence: 'unknown',
          voided: false,
          voidReason: null,
          errorMessage: errMsg,
        }
      }, { status: 200 });
    }

    const data = await resp.json();
    let outputText = data.output_text || '';
    const extractedUrls = [];

    for (const item of data.output || []) {
      if (item.type === 'message') {
        for (const content of item.content || []) {
          if (content.type === 'output_text') {
            outputText += content.text;
            for (const ann of content.annotations || []) {
              if (ann.type === 'url_citation' && ann.url) {
                extractedUrls.push(ann.url);
              }
            }
          }
        }
      }
    }

    // Parse JSON from output — robust multi-strategy extraction
    let parsed;
    const tryParse = (str) => { try { return JSON.parse(str); } catch (_) { return null; } };

    // Strategy 1: Strip code fences, try direct parse
    const cleaned = outputText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    parsed = tryParse(cleaned);

    // Strategy 2: Find all top-level { ... } blocks, try largest first
    if (!parsed) {
      const blocks = [];
      let depth = 0, start = -1, inStr = false, esc = false;
      for (let i = 0; i < outputText.length; i++) {
        const ch = outputText[i];
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === '{') { if (depth === 0) start = i; depth++; }
        else if (ch === '}') { depth--; if (depth === 0 && start >= 0) { blocks.push(outputText.slice(start, i + 1)); start = -1; } }
      }
      blocks.sort((a, b) => b.length - a.length);
      for (const block of blocks) { parsed = tryParse(block); if (parsed) break; }
    }

    // Strategy 3: Greedy regex fallback
    if (!parsed) {
      const match = outputText.match(/\{[\s\S]*\}/);
      if (match) parsed = tryParse(match[0]);
    }

    if (!parsed) {
      return Response.json({
        resultLookup: {
          resultLookupStatus: 'no_results',
          resultSource: 'openai_result_lookup',
          sourceUrls: extractedUrls,
          winnerSelectionIds: [],
          placedSelectionIds: [],
          selectedRunnerFinishPosition: null,
          opponentFinishPosition: null,
          resultConfidence: 'unknown',
          voided: false,
          voidReason: null,
          errorMessage: 'Failed to parse result lookup response',
          rawOutputSnippet: outputText.slice(0, 1000),
        }
      }, { status: 200 });
    }

    // Build winner/placed arrays from parsed data
    const winnerSelectionIds = [];
    const placedSelectionIds = [];

    if (parsed.found) {
      if (parsed.winnerSelectionId) {
        winnerSelectionIds.push(String(parsed.winnerSelectionId));
      }
      // If we know the winner's name but not selectionId, try to match by runnerName
      if (parsed.winnerName && !parsed.winnerSelectionId) {
        // The caller will need to resolve winner name to selectionId
        // For now, include the runnerName in the response
      }

      if (Array.isArray(parsed.placedRunners)) {
        for (const pr of parsed.placedRunners) {
          if (pr.selectionId) {
            placedSelectionIds.push(String(pr.selectionId));
          }
        }
      }

      // If the selected runner's finish position is known, derive winner/placed status
      if (parsed.selectedRunnerFinishPosition != null) {
        if (parsed.selectedRunnerFinishPosition === 1 && !winnerSelectionIds.includes(String(selectionId))) {
          winnerSelectionIds.push(String(selectionId));
        }
        // For PLACE markets, placed = finished within place terms (usually top 3)
        const placeCount = marketType === 'PLACE' ? 3 : 1;
        if (parsed.selectedRunnerFinishPosition <= placeCount && !placedSelectionIds.includes(String(selectionId))) {
          placedSelectionIds.push(String(selectionId));
        }
      }
    }

    const status = parsed.found === true ? 'success' : 'no_results';
    const confidence = parsed.confidence || 'unknown';

    return Response.json({
      resultLookup: {
        resultLookupStatus: status,
        resultSource: 'openai_result_lookup',
        sourceUrls: extractedUrls,
        winnerSelectionIds,
        placedSelectionIds,
        selectedRunnerFinishPosition: parsed.selectedRunnerFinishPosition ?? null,
        opponentFinishPosition: parsed.opponentFinishPosition ?? null,
        resultConfidence: confidence,
        voided: false,
        voidReason: null,
        winnerName: parsed.winnerName || '',
        raceNotes: parsed.raceNotes || '',
      }
    }, { status: 200 });
  } catch (fetchErr) {
    const isTimeout = fetchErr.name === 'TimeoutError' || fetchErr.message?.includes('timeout');
    return Response.json({
      resultLookup: {
        resultLookupStatus: isTimeout ? 'timeout' : 'error',
        resultSource: 'openai_result_lookup',
        sourceUrls: [],
        winnerSelectionIds: [],
        placedSelectionIds: [],
        selectedRunnerFinishPosition: null,
        opponentFinishPosition: null,
        resultConfidence: 'unknown',
        voided: false,
        voidReason: null,
        errorMessage: isTimeout ? 'Result lookup timed out after 60s' : fetchErr.message,
      }
    }, { status: 200 });
  }
}