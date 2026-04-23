import { callGeminiText, isGeminiConfigured } from '../lib/gemini.js'
import { anthropic, callClaude } from '../lib/anthropic.js'
import { db, reverseBriefs, copyAssets, creativeAssets, advertorialDesigns, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and } from 'drizzle-orm'

const GEMINI_SYSTEM = `You are the world's best direct-response copywriter for telemedicine.

Output a complete, self-contained HTML advertorial (no <html>/<head> wrapper — just the <article> element and its contents).
- Use the provided image URLs verbatim in <img> tags at the slots indicated in the image manifest.
- 1500–2500 words of body copy.
- Write semantic HTML: <article>, <section>, <h1>/<h2>, <p>, <blockquote>, <figure><img><figcaption>, <a class="cta">.
- Open with a story-based hook mirroring the reader's exact situation.
- Build credibility through specific details, not vague claims.
- Bridge from the reader's current reality to the product solution.
- Use social proof that feels earned: specific names, ages, results.
- Close with urgency that feels logical, not manufactured.
- Match the voice, structure, and mechanics prescribed in the reverse brief.
- No meta-commentary. No placeholders. No markdown. Start with <article>.`

const CLAUDE_SYSTEM = `You are the world's best direct-response copywriter for telemedicine.

Write long-form advertorials (1500–2500 words) that:
1. Open with a story-based hook mirroring the reader's exact situation
2. Build credibility through specific details, not vague claims
3. Bridge from the reader's current reality to the product solution using belief bridges
4. Use social proof that feels earned: specific names, ages, results
5. Close with urgency that feels logical, not manufactured

Follow the reverse brief exactly — match the voice, structure, and conversion mechanics of the top competitor advertorial.

Output ONLY the advertorial. No meta-commentary. No placeholders. Start with the headline.`

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

  if (isGeminiConfigured()) {
    const imageManifest = designAssets.length > 0
      ? designAssets.map((a) => `- slot: ${a.id.slice(0, 8)} | url: ${a.storageUrl} | aspect: ${a.format}`).join('\n')
      : '(no design images available — write without images)'

    const designContext = designRecord
      ? `\nDesign palette: ${JSON.stringify((designRecord.colorPaletteJson as string[]) ?? [])}\nTypography: ${designRecord.typographyPairing ?? ''}\n`
      : ''

    try {
      content = await callGeminiText({
        system: GEMINI_SYSTEM,
        prompt: `Write a 1500–2500 word HTML advertorial.

Concept: ${primary.concept}
Hook: ${primary.hook}
Angle: ${primary.angle}
Headline: ${primary.headline}
${designContext}
Reverse Brief:
${JSON.stringify(brief.briefJson, null, 2)}

Available images (use each once in a coherent order):
${imageManifest}

Source competitor URL: ${brief.sourceUrl}

Write the complete HTML advertorial now, starting with <article>.`,
        maxOutputTokens: 8192,
        temperature: 0.8,
      })
    } catch (err) {
      await log(runId, 'ADVERTORIAL_COPY', `Gemini failed (${(err as Error).message}) — falling back to Claude`, 'warn')
      content = await callClaude(anthropic, {
        model: 'claude-opus-4-7',
        system: CLAUDE_SYSTEM,
        messages: [{ role: 'user', content: `Write a 1500-2500 word advertorial.\n\nConcept: ${primary.concept}\nHook: ${primary.hook}\nAngle: ${primary.angle}\nHeadline: ${primary.headline}\n\nReverse Brief:\n${JSON.stringify(brief.briefJson, null, 2)}\n\nSource competitor URL: ${brief.sourceUrl}\n\nWrite the complete advertorial now.` }],
        maxTokens: 8192,
        thinkingBudget: 4000,
      })
    }
  } else {
    content = await callClaude(anthropic, {
      model: 'claude-opus-4-7',
      system: CLAUDE_SYSTEM,
      messages: [{ role: 'user', content: `Write a 1500-2500 word advertorial.\n\nConcept: ${primary.concept}\nHook: ${primary.hook}\nAngle: ${primary.angle}\nHeadline: ${primary.headline}\n\nReverse Brief:\n${JSON.stringify(brief.briefJson, null, 2)}\n\nSource competitor URL: ${brief.sourceUrl}\n\nWrite the complete advertorial now.` }],
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
