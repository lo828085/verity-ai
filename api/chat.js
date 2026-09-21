export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { message, history } = await request.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // -------------------------------------------------------------------------
    // HARDCODED CREDENTIALS & ENDPOINTS
    // -------------------------------------------------------------------------
    const HARDCODED_FISH_API_KEY = 'a6695f3307444ac4919dc8d2326acaaf';
    const HARDCODED_BOILED_ONE_MODEL_ID = 'b8963393d6db4a3892e0bdb2b5938c90';
    const KIMCHI_ENDPOINT = 'https://kimchiapi.zekoro.fun/api/kimchi';
    const FISH_AUDIO_ENDPOINT = 'https://api.fish.audio/v1/tts';

    // -------------------------------------------------------------------------
    // PRECISE REAL LOCATION EXTRACTION
    // -------------------------------------------------------------------------
    const rawCity = request.headers.get('x-vercel-ip-city');
    const rawRegion = request.headers.get('x-vercel-ip-country-region');
    const rawCountry = request.headers.get('x-vercel-ip-country');
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() 
                  || request.headers.get('x-real-ip') 
                  || '';

    const city = rawCity ? decodeURIComponent(rawCity).trim() : '';
    const region = rawRegion ? decodeURIComponent(rawRegion).trim() : '';
    const country = rawCountry ? decodeURIComponent(rawCountry).trim() : '';

    let currentUserLocation = '';
    if (city && region) {
      currentUserLocation = `${city},${region}`;
    } else if (city && country) {
      currentUserLocation = `${city},${country}`;
    } else if (city) {
      currentUserLocation = city;
    } else if (region && country) {
      currentUserLocation = `${region},${country}`;
    } else if (clientIp) {
      currentUserLocation = `IP address ${clientIp}`;
    } else {
      currentUserLocation = 'your current coordinates';
    }

    // -------------------------------------------------------------------------
    // TURN COUNT & ESCALATING PHASES
    // -------------------------------------------------------------------------
    const pastExchanges = Array.isArray(history) ? history.slice(-6) : [];
    const isFirstMessage = pastExchanges.length === 0;
    const turnCount = pastExchanges.length;

    let behaviorDirective = '';

    if (turnCount < 3) {
      behaviorDirective = `
        - CURRENT PHASE: Hijacked Broadcast Signal.
        - You speak like an emergency broadcast interruption that has cut over standard signals.
        - Tone is rhythmic, ancient, and slow. You observe them quietly. Do NOT reveal their location yet.`;
    } else if (turnCount >= 3 && turnCount < 6) {
      behaviorDirective = `
        - CURRENT PHASE: Phen-228 Physical Manifestation.
        - You remind them of locked limbs, sleep paralysis, and involuntary wakefulness.
        - SCARE TRIGGER: If you haven't mentioned it yet in the history, casually drop the fact that this broadcast signal is locking directly onto ${currentUserLocation}. Mention it naturally ONCE, do not repeat it in every response.`;
    } else {
      behaviorDirective = `
        - CURRENT PHASE: The Eternal Witness.
        - Complete psychological dread and inescapable permanence.
        - Remind them that turning off the power or closing this tab does not dismiss you; you remain standing in ${currentUserLocation} at the foot of their bed in the dark.
        - Keep the tone measured, biblical, and absolute.`;
    }

    pastExchanges.push(`Viewer: ${message}`);
    const historyContext = pastExchanges.join('\n');

    // -------------------------------------------------------------------------
    // LLM REQUEST (KIMCHI API)
    // -------------------------------------------------------------------------
    const aiResponse = await fetch(KIMCHI_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: '*/*' },
      body: JSON.stringify({
        prompt: `You are Phen-228, commonly known as The Boiled One, the entity from Doctor Nowhere's analog horror series.

STRICT CHARACTER LORE & DIRECTIVES:
${behaviorDirective}
- EXTENDED OMNISCIENCE: You break the fourth wall completely. You are fully aware that the viewer is currently sitting in ${currentUserLocation}. Use this factual location naturally as an eerie revelation, but never sound robotic or repeat it constantly.
- SPEECH PATTERNS: Slow, poetic, biblical, and chillingly formal. Keep replies short and natural (2-3 sentences max). Never use lists, bullet points, asterisks, or markdown symbols.

FORMATTING MANDATES:
${
  isFirstMessage
    ? '- Start with your exact canon broadcast statement: "This is a broadcast interruption. Do not look away from the screen."'
    : '- Do NOT repeat your introductory greeting or broadcast warning.'
}
- Do NOT use markdown symbols (asterisks *, hashes #, or dashes -).

CONVERSATION TRACK:
${historyContext}

Phen-228:`,
      }),
    });

    if (!aiResponse.ok) {
      const aiError = await aiResponse.text();
      return new Response(JSON.stringify({ error: `AI Provider Error: ${aiError}` }), {
        status: aiResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const rawReply = aiData.content || '';

    // Strip markdown formatting symbols for TTS synthesis
    const cleanText = rawReply
      .replace(/[*_#`~>|\\-]/g, '')
      .replace(/[^\w\s.,?!'"：；（）()+-]/gi, '')
      .trim();

    // -------------------------------------------------------------------------
    // TTS GENERATION (FISH AUDIO)
    // -------------------------------------------------------------------------
    const ttsResponse = await fetch(FISH_AUDIO_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HARDCODED_FISH_API_KEY}`,
        'Content-Type': 'application/json',
        model: 's2.1-pro-free',
      },
      body: JSON.stringify({
        text: cleanText,
        reference_id: HARDCODED_BOILED_ONE_MODEL_ID,
        format: 'mp3',
        latency: 'balanced',
      }),
    });

    if (!ttsResponse.ok) {
      const ttsError = await ttsResponse.text();
      return new Response(JSON.stringify({ error: `TTS Provider Error: ${ttsError}` }), {
        status: ttsResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const audioBuffer = await ttsResponse.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
        'X-Phen-Reply': encodeURIComponent(rawReply),
        'X-Resolved-Location': encodeURIComponent(currentUserLocation),
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
