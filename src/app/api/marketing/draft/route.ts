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
4. DESCRIPTION (short, reads fast on a phone):
   - 1-2 line hook expanding the title's promise; end on a reason to watch, not a summary.
   - One line of context naming the guest + tying to the episode (e.g. "Kris Bennatti, founder of
     Hudson Labs, on Invest with AI."). Use [GUEST NAME] if not clear from transcript.
   - CTA: "Full episode: [LINK]"
5. HASHTAGS: ~6, professional not spammy. Default: #investing #AI #hedgefunds #buyside #finance #InvestWithAI
   (swap 1-2 for the clip's specific topic if clearly relevant).

Return STRICT JSON only, no prose, no markdown fences:
{"title": "...", "description": "...", "hashtags": "#... #..."}
The description must NOT include the hashtags (those go in the hashtags field).
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
4. HASHTAGS: #InvestWithAI #AI #AIinvesting #buyside #hedgefunds #fundamentalinvesting

Return STRICT JSON only, no prose, no markdown fences:
{"title": "...", "description": "...", "hashtags": "#... #..."}
The description SHOULD include the timestamps and CTA blocks, but NOT the hashtags (those go in the hashtags field).
`.trim()

function extractJson(text: string): { title: string; description: string; hashtags: string } | null {
  if (!text) return null
  // strip markdown fences if present
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  // grab the first {...} block
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    const obj = JSON.parse(t.slice(start, end + 1))
    return {
      title: String(obj.title || ''),
      description: String(obj.description || ''),
      hashtags: String(obj.hashtags || ''),
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
