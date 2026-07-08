import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
    const { market, runners, settings } = body;

    const base44 = createClientFromRequest(req);
    let user;
    try { user = await base44.auth.me(); } catch (_) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

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

    const searchQuery = `Australian horse racing ${venue} Race ${raceNumber} ${dateStr} ${activeRunners.map(r => r.runnerName).join(' ')} tips form track condition scratchings`.trim();

    const systemPrompt = `You are a horse racing research analyst for Australian races. You search the web for current public race-day information and return it as structured JSON.

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

    const userPrompt = `Research this Australian horse race using web search:

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

    // Parse JSON from the output
    let parsed;
    try {
      const cleaned = outputText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (_) {
      const match = outputText.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch (__) {
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
            }
          }, { status: 200 });
        }
      } else {
        return Response.json({
          externalSearchResult: {
            eventId: market.eventId || '',
            eventName,
            marketStartTime: startTime,
            searchStatus: 'no_results',
            searchProvider: 'openai_web_search',
            searchQuery,
            searchedAt: new Date().toISOString(),
            sourceCount: extractedSources.length,
            sources: extractedSources,
            runnerResearch: [],
            raceLevelNotes: '',
            dataQuality: 0,
            errorMessage: 'No JSON found in OpenAI output',
          }
        }, { status: 200 });
      }
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