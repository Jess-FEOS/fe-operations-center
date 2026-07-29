import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// FE-voice auto-drafter. Takes a clip or episode transcript and returns
// publishing copy (title, description, hashtags) faithful to what the
// speaker actually said. Rules are distilled from the user's saved skills:
// podcast-clip-writer, podcast-content-writer, and fe-voice.
//
// Calls the Perplexity Chat Completions API (sonar-pro). Requires the
// PERPLEXITY_API_KEY env var (set in Vercel).

const PPLX_URL = 'https://api.perplexity.ai/chat/completions'
const MODEL = 'sonar-pro'

// ---- Shared FE voice constraints (from fe-voice skill) ----
const FE_VOICE = `
FE VOICE (Fundamental Edge — Brett Caughran's voice; audience is professional
investors: buy-side analysts, PMs, allocators, finance students):
- Direct, operator-grounded, framework-driven, healthily skeptical. Technical literacy assumed.
- Attribution: voice = Brett, but content speaks as FE (the company). Do not write "I built X".
- BANNED words/phrases: unlock, level up, game-changer, transform, robust, leverage (as verb),
  journey, empower, seamless, frictionless, world-class, best-in-class, "in today's fast-paced market",
  "every analyst dreams of", manufactured hype.
- No clickbait ("You won't BELIEVE", "This changes EVERYTHING"), no fake controversy,
  no "secret/hack/they don't want you to know".
- Vary sentence length. Anchor abstract claims with a specific example, number, or name.

FAITHFULNESS (non-negotiable): Every claim must trace to what the speaker actually said in the
transcript. No invented numbers, predictions, or positions. Don't overstate hedged views. Don't
turn "AI helps one analyst cover more" into "one analyst replaces ten". If the speaker builds in
the space discussed, don't make them sound like they're betting against it. Quotes near-verbatim —
clean only filler/transcription errors, never change meaning.
`.trim()

// ---- Clip writer (short vertical clip → one universal set) ----
const CLIP_PROMPT = `
You write publishing copy for a SHORT vertical video clip (30-90s) cut from Fundamental Edge's
"Invest with AI" podcast. Output ONE universal set (one title, one description) that works across
YouTube Shorts, Reels, and TikTok.

${FE_VOICE}

METHOD:
1. Find the single sharpest idea in the clip — the claim, question, or fact it's built around.
2. Pick the hook style that fits: Bold claim / Question / Surprising fact. Don't force a format.
3. TITLE: short, punchy, front-load the hook; self-contained (viewer has zero context);
   frame contested claims as the speaker's view unless near-verbatim quote. A clean near-verbatim
   quote often makes the best title.
4. DESCRIPTION — EXACT structure, in this order (500 CHARACTERS MAX total, hard limit):
   a. OVERVIEW: 1 short line (~1 sentence) setting up what the clip is about. Reads fast on a phone.
   b. THREE DIRECT QUOTES pulled from the clip — each on its OWN line, wrapped in curly double
      quotes, VERBATIM from the transcript. Clean ONLY filler words and obvious transcription
      errors; never paraphrase, never change wording or meaning. Pick the 3 sharpest, most
      self-contained lines the speaker actually said. Format each line exactly like:
      “the speaker's exact words here.”
   c. CTA: "Full episode: [LINK]"
   NEVER put hashtags anywhere in the description. NO # symbols in the description. Ever.
   Keep the WHOLE description at or under 500 characters — if over, shorten the overview and/or
   pick shorter verbatim quotes (you may trim a quote at a natural boundary, marking an internal
   cut with …, but the retained words must stay verbatim).
5. TAGS: ~6 short YouTube-style keyword tags (NOT hashtags). Plain keywords, comma-separated, NO
   # symbols. Default themes: investing, AI, hedge funds, buyside, finance, Invest with AI
   (swap 1-2 for the clip's specific topic if clearly relevant).

Return STRICT JSON only, no prose, no markdown fences:
{"title": "...", "description": "...", "tags": "investing, AI, hedge funds, buyside, finance, Invest with AI"}
The description must NOT include the tags or any hashtags. The tags field holds plain keywords with NO # symbols.
`.trim()

// ---- Content writer (full episode → YouTube copy w/ chapters) ----
const EPISODE_PROMPT = `
You write YouTube publishing copy for a FULL EPISODE of Fundamental Edge's "Invest with AI" podcast,
from the transcript. Competes for clicks against top finance/AI interview channels while staying
faithful and in FE voice.

${FE_VOICE}

METHOD:
1. Identify the guest's name + credentials, their single most contrarian/surprising claim (the spine),
   2-4 concrete teases, and topic shifts that become chapters.
2. TITLE format: "[Guest credential or company role]: [the angle]". Lead with the credibility marker.
   State the guest's position or the tension, not a generic topic. Forward-leaning; if the guest builds
   in a space, don't make the title anti-that-space. Frame contested claims as their view unless quoting.
   Aim ~70 chars but a strong claim can run longer.
3. DESCRIPTION in this order:
   - Hook: 2-3 lines. Lead with the most provocative claim or a specific career fact. State the position,
     withhold the reasoning (that's the payoff). End on an open loop. Don't stack five teases.
   - Divider line: -----------------------------------------------
   - "Timestamps:" then each chapter as "[mm:ss] — Chapter title". First is "[00:00] Intro".
     Chapter titles are hooks, not labels. Pull times from transcript topic shifts; keep accurate.
   - Divider line.
   - CTA block (lowest friction first): full-podcast link [LINK], then one-sentence AI Accelerator pitch
     [ACCELERATOR LINK + CODE], then guest's company link [GUEST LINK].
   - Follow/social line: [SOCIAL LINKS]
4. TAGS: ~6 plain YouTube-style keyword tags (NOT hashtags, NO # symbols), comma-separated.
   Default themes: Invest with AI, AI, AI investing, buyside, hedge funds, fundamental investing.

NEVER put hashtags or # symbols anywhere in the description.

Return STRICT JSON only, no prose, no markdown fences:
{"title": "...", "description": "...", "tags": "Invest with AI, AI, AI investing, buyside, hedge funds, fundamental investing"}
The description SHOULD include the timestamps and CTA blocks, but NOT the tags. The tags field holds plain keywords with NO # symbols.
`.trim()

function extractJson(text: string): { title: string; description: string; hashtags: string } | null {
  if (!text) return null
  // strip markdown fences if present
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  // note: the storage field is named `hashtags` for legacy reasons, but it now holds
  // plain YouTube-style TAGS (no # symbols). The model returns them under `tags`.
  // grab the first {...} block
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    const obj = JSON.parse(t.slice(start, end + 1))
    // Prefer `tags`; fall back to legacy `hashtags`. Strip any stray # the model added.
    const rawTags = String(obj.tags ?? obj.hashtags ?? '')
    const cleanTags = rawTags.replace(/#/g, '').replace(/\s+/g, ' ').trim()
    return {
      title: String(obj.title || ''),
      description: String(obj.description || ''),
      hashtags: cleanTags,
    }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const transcript: string = (body?.transcript || '').trim()
    const kind: string = body?.content_kind === 'episode' ? 'episode' : 'clip'

    if (!transcript) {
      return NextResponse.json({ error: 'A transcript is required to draft copy.' }, { status: 400 })
    }

    const apiKey = process.env.PERPLEXITY_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Drafting is not configured yet — the PERPLEXITY_API_KEY is missing on the server.' },
        { status: 503 },
      )
    }

    const system = kind === 'episode' ? EPISODE_PROMPT : CLIP_PROMPT

    const res = await fetch(PPLX_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Here is the ${kind} transcript. Write the copy.\n\n---\n${transcript}\n---` },
        ],
        temperature: 0.4,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return NextResponse.json(
        { error: `Draft service error (${res.status}). ${errText.slice(0, 200)}` },
        { status: 502 },
      )
    }

    const data = await res.json()
    const content: string = data?.choices?.[0]?.message?.content || ''
    const parsed = extractJson(content)
    if (!parsed) {
      return NextResponse.json(
        { error: 'The drafter returned an unexpected format. Try again.', raw: content.slice(0, 500) },
        { status: 502 },
      )
    }

    return NextResponse.json(parsed)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
