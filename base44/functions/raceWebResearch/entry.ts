import { createClientFromRequest } from 'npm:@base44/sdk@0.8.37';

// ============================================================================
// raceWebResearch — OpenAI web search for public race-day information
//
// Uses the OpenAI Responses API with the web_search tool to gather:
//   race fields, scratchings, runner form, track condition, weather,
//   trainer/jockey info, tips, market news, gear changes, barriers.
//
// Returns a structured JSON summary that is fed into the Featherless AI
// decision prompt as supplementary context. This function does NOT place bets.
// ============================================================================

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { market, runners } = body;

    const base44 = createClientFromRequest(req);
    let user;
    try { user = await base44.auth.me(); } catch (_) {
      return Response.json({ error: 'Authentication required. Please log in and try again.' }, { status: 401 });
    }
    if (!user) return Response.json({ error: 'Authentication required. Please log in and try again.' }, { status: 401 });

    if (!market) return Response.json({ error: 'market is required' }, { status: 400 });

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return Response.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });

    const venue = market.venue || '';
    const raceNumber = market.raceNumber || '';
    const startTime = market.startTime || market.marketStartTime || '';
    const marketName = market.marketName || '';
    const runnerNames = (runners || [])
      .filter((r: any) => r.status === 'ACTIVE' && r.runnerName)
      .map((r: any) => r.runnerName)
      .slice(0, 20);

    const dateStr = startTime
      ? new Date(startTime).toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : '';

    const systemPrompt = `You are a horse racing research assistant for Australian races. You search the web for current public race-day information and return it in a structured JSON format. Return ONLY valid JSON — no markdown, no code fences, no commentary outside the JSON.`;

    const userPrompt = `Research this Australian horse race using web search:

Venue: ${venue}
Race number: ${raceNumber}
Race type: ${marketName}
Start time: ${startTime}
Date: ${dateStr}
Runners: ${runnerNames.join(', ')}

Search the web for:
- Race fields and final declarations
- Scratchings / non-runners
- Runner form (recent starts, wins, places)
- Track condition (e.g. Good 4, Soft 5, Heavy 8)
- Weather impact on the track
- Trainer and jockey information (strike rates, recent form)
- Recent results at this track
- Public tips and previews
- Market news (favourite moves, drifters)
- Gear changes (blinkers, tongue tie, etc.)
- Barrier / draw information
- Any other relevant race-day information

Return ONLY this JSON structure (use empty strings or empty arrays if no data found):
{
  "venue": "${venue}",
  "race": "Race ${raceNumber} - ${marketName}",
  "start_time": "${startTime}",
  "track_condition": "",
  "weather": "",
  "scratchings": [],
  "runner_notes": [{"runner": "", "notes": ""}],
  "form_comments": "",
  "trainer_jockey_notes": "",
  "public_tips": [],
  "market_news": "",
  "risk_warnings": [],
  "research_summary": "",
  "data_quality": "good"
}`;

    const requestStart = Date.now();

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

    const responseTimeMs = Date.now() - requestStart;

    if (!resp.ok) {
      const errText = await resp.text();
      let errMessage = `OpenAI API error ${resp.status}`;
      try { const errJson = JSON.parse(errText); errMessage = errJson.error?.message || errMessage; } catch (_) {}
      return Response.json({ error: errMessage, status: resp.status, responseTimeMs }, { status: 502 });
    }

    const data = await resp.json();

    // Extract output text and URL citations from the response
    let outputText = data.output_text || '';
    const sourceLinks: any[] = [];

    for (const item of data.output || []) {
      if (item.type === 'message') {
        for (const content of item.content || []) {
          if (content.type === 'output_text') {
            outputText += content.text;
            for (const ann of content.annotations || []) {
              if (ann.type === 'url_citation' && ann.url) {
                sourceLinks.push({ title: ann.title || ann.url, url: ann.url });
              }
            }
          }
        }
      }
    }

    if (!outputText) {
      return Response.json({ error: 'OpenAI returned no output text', responseTimeMs }, { status: 502 });
    }

    // Parse JSON from the output text
    let parsed;
    try {
      const cleaned = outputText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (_) {
      const match = outputText.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch (_) {
          return Response.json({ error: 'Failed to parse research JSON', rawResponse: outputText.slice(0, 2000), responseTimeMs }, { status: 422 });
        }
      } else {
        return Response.json({ error: 'No JSON found in research output', rawResponse: outputText.slice(0, 2000), responseTimeMs }, { status: 422 });
      }
    }

    // Ensure source_links exists (prefer extracted URL citations)
    if ((!parsed.source_links || parsed.source_links.length === 0) && sourceLinks.length > 0) {
      parsed.source_links = sourceLinks;
    } else if (!parsed.source_links) {
      parsed.source_links = [];
    }

    return Response.json({
      success: true,
      research: parsed,
      sourceLinks: parsed.source_links,
      responseTimeMs,
      model: 'gpt-4o-mini',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});