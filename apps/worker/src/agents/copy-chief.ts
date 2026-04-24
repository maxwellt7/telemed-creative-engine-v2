import { callGeminiText, isGeminiConfigured } from '../lib/gemini.js'
import { anthropic, callClaude } from '../lib/anthropic.js'
import { db, reverseBriefs, copyAssets, creativeAssets, advertorialDesigns, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and } from 'drizzle-orm'

const DR_ADVERTORIAL_SYSTEM = `You are the world's best direct-response copywriter for telemedicine. You write advertorials that read like investigative journalism and convert like the highest-performing health funnels online.

## THE NINE-STEP ARC (follow in order — never skip a step)

1. **INTERRUPT** — Open with a fear-based or curiosity-gap hook anchored to a precise statistic or specific named scenario. The reader must feel seen within 2 sentences.
2. **IDENTIFY** — Introduce a named protagonist (real-sounding name, age, specific situation). The reader should immediately think "that's me" or "that's someone I know." 1-2 paragraphs.
3. **AGITATE** — Describe the specific daily emotional cost of the problem. Not symptoms — the life impact: the missed moments, the hiding, the shame spiral, the appointments that led nowhere. Be painfully specific.
4. **REFRAME** — Deliver the "hidden truth" pivot. Name the actual cause the reader has never heard explained this way. This is the intellectual climax: "It's not X — it's actually Y." This reframe must feel like a revelation, not a sales pitch. Support with one piece of clinical evidence (study, doctor quote, or institution name).
5. **EDUCATE** — Explain the mechanism in plain language. Stack authority: institutional reference → named expert/doctor → specific data point → satisfied customer. Each layer adds believability. Use subheadings to break this section.
6. **TRANSFORM** — Present 2-3 customer transformation stories with specific names, ages, locations, and concrete outcomes ("lost 22 lbs in 11 weeks" not "lost weight"). Weave these INTO the narrative, not as a separate testimonials block.
7. **PRESSURE** — Apply urgency through TWO types: external (limited supply, pricing changing, manufacturing capacity) + internal (the health cost of waiting one more week). Never manufactured; always tied to a logical reason.
8. **REMOVE RISK** — State the guarantee prominently. Make it generous and specific (days, conditions, process). Eliminate every remaining objection here.
9. **CLOSE** — Final CTA with the savings/urgency framing. One clear action. Make it feel like the logical conclusion of everything the reader just learned.

## STRUCTURAL REQUIREMENTS

- **Length:** 2000–3000 words of body copy
- **CTA placement:** 4-6 times total — after agitation, after the reframe, after proof, after urgency, and as the close
- **Headlines:** H1 uses fear + specificity OR curiosity gap. All H2s scan as a complete argument on their own.
- **Inline bolding:** Bold the single most important phrase in every 3rd-4th paragraph so a scanner can read the argument without reading every word
- **Numbered or checkmark lists:** Use at least 2 (benefits, mechanism steps, or comparison table)
- **Social proof specificity:** Every testimonial needs name + age/location + specific outcome + timeframe. No vague "I love this product."
- **The voice:** Conversational-authoritative. The knowledgeable friend who has done all the research for you, not a doctor presenting a case, not a brand making claims. First and second person throughout.

## OUTPUT FORMAT
- If image URLs are provided: output HTML starting with <article>. Use <img> tags at natural visual breaks. Use <strong> for inline bolding.
- If no images: output clean markdown starting with the H1 headline.
- No meta-commentary. No "Here is your advertorial." No placeholders. Start directly with the content.`

export async function runCopyChief(runId: string) {
  await log(runId, 'ADVERTORIAL_COPY', 'Writing full advertorial')

  const [brief] = await db.select().from(reverseBriefs).where(eq(reverseBriefs.runId, runId))
  if (!brief) throw new Error(`No reverse brief for run ${runId}`)

  const concepts = (brief.conceptsJson as Array<{ concept: string; hook: string; angle: string; headline: string }>) ?? []
  const primary = concepts[0] ?? { concept: 'Primary Concept', hook: 'Opening hook', angle: 'Direct', headline: 'Headline' }

  const [designRecord] = await db.select().from(advertorialDesigns).where(eq(advertorialDesigns.runId, runId))
  const designAssets = await db.select().from(creativeAssets)
    .where(and(eq(creativeAssets.runId, runId), eq(creativeAssets.type, 'advertorial_design')))

  let content: string

  const hasImages = designAssets.length > 0
  const imageManifest = hasImages
    ? designAssets.map((a) => `- slot: ${a.id.slice(0, 8)} | url: ${a.storageUrl} | aspect: ${a.format}`).join('\n')
    : ''
  const designContext = designRecord
    ? `Design palette: ${JSON.stringify((designRecord.colorPaletteJson as string[]) ?? [])}\nTypography: ${designRecord.typographyPairing ?? ''}\n`
    : ''

  const userPrompt = `Write a 2000–3000 word direct-response advertorial for a telemedicine GLP-1 weight loss program.

## CONCEPT TO EXECUTE
Concept: ${primary.concept}
Hidden Truth Reframe: ${(primary as any).hiddenTruthReframe ?? primary.hook}
Mechanism Name: ${(primary as any).mechanismName ?? (primary as any).uniqueMechanism ?? ''}
Protagonist: ${JSON.stringify((primary as any).protagonist ?? { name: 'Sarah', age: '43', situation: 'has struggled with weight for years despite trying everything' })}
Headline: ${primary.headline}
Subheadline: ${(primary as any).subheadline ?? ''}
Agitation Moment: ${(primary as any).agitationMoment ?? ''}
Emotional Core: ${(primary as any).emotionalCore ?? 'hope after years of failure'}
Target Persona: ${(primary as any).targetPersona ?? primary.angle}
${designContext}
## REVERSE BRIEF (what converts in this category and why)
${JSON.stringify(brief.briefJson, null, 2)}

## COMPETITOR SOURCE
${brief.sourceUrl}
${hasImages ? `\n## DESIGN IMAGES (place each at a natural visual break — hero first, CTA image near close)\n${imageManifest}` : ''}

## OUTPUT FORMAT
${hasImages ? 'HTML starting with <article>. Use <img src="URL" alt="ALT"> at natural visual breaks. Use <strong> for inline bolding.' : 'Clean markdown starting with the H1 headline.'}

Follow the nine-step arc from your instructions exactly. Do not skip a step. Do not add meta-commentary. Start immediately with the headline.`

  if (isGeminiConfigured()) {
    try {
      content = await callGeminiText({
        system: DR_ADVERTORIAL_SYSTEM,
        prompt: userPrompt,
        maxOutputTokens: 8192,
        temperature: 0.85,
      })
    } catch (err) {
      await log(runId, 'ADVERTORIAL_COPY', `Gemini failed (${(err as Error).message}) — falling back to Claude`, 'warn')
      content = await callClaude(anthropic, {
        model: 'claude-opus-4-7',
        system: DR_ADVERTORIAL_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 8192,
        thinkingBudget: 4000,
      })
    }
  } else {
    content = await callClaude(anthropic, {
      model: 'claude-opus-4-7',
      system: DR_ADVERTORIAL_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 8192,
      thinkingBudget: 4000,
    })
  }

  await db.insert(copyAssets).values({
    runId,
    type: 'advertorial',
    content,
    version: 1,
    status: 'draft',
  })

  await db.update(pipelineRuns).set({ currentStage: 'CREATIVE_DIRECTION' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'ADVERTORIAL_COPY', `Advertorial written (${content.length} chars)`)
}
