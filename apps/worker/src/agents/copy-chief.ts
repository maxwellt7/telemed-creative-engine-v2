import { anthropic, callClaude } from '../lib/anthropic.js'
import { db, reverseBriefs, copyAssets, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq } from 'drizzle-orm'

const SYSTEM_PROMPT = `You are the world's best direct-response copywriter for telemedicine.

Write long-form advertorials (1500–2500 words) that:
1. Open with a story-based hook mirroring the reader's exact situation
2. Build credibility through specific details, not vague claims
3. Bridge from the reader's current reality to the product solution using belief bridges
4. Use social proof that feels earned: specific names, ages, results
5. Close with urgency that feels logical, not manufactured

Follow the reverse brief exactly — match the voice, structure, and conversion mechanics of the top competitor advertorial, but position THIS product as the superior alternative.

Output ONLY the advertorial. No meta-commentary. No placeholders. Start with the headline.`

export async function runCopyChief(runId: string) {
  await log(runId, 'ADVERTORIAL_COPY', 'Writing full advertorial')

  const [brief] = await db.select().from(reverseBriefs).where(eq(reverseBriefs.runId, runId))
  if (!brief) throw new Error(`No reverse brief for run ${runId}`)

  const concepts = brief.conceptsJson as Array<{ concept: string; hook: string; angle: string; headline: string }> ?? []
  const primary = concepts[0] ?? { concept: 'Primary Concept', hook: 'Opening hook', angle: 'Direct', headline: 'Headline' }

  const advertorial = await callClaude(anthropic, {
    model: 'claude-opus-4-7',
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Write a 1500-2500 word advertorial.\n\nConcept: ${primary.concept}\nHook: ${primary.hook}\nAngle: ${primary.angle}\nHeadline: ${primary.headline}\n\nReverse Brief:\n${JSON.stringify(brief.briefJson, null, 2)}\n\nSource competitor URL: ${brief.sourceUrl}\n\nWrite the complete advertorial now.`,
    }],
    maxTokens: 8192,
    thinkingBudget: 4000,
  })

  await db.insert(copyAssets).values({
    runId,
    type: 'advertorial',
    content: advertorial,
    version: 1,
    status: 'draft',
  })

  await db.update(pipelineRuns).set({ currentStage: 'CREATIVE_DIRECTION' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'ADVERTORIAL_COPY', `Advertorial written (${advertorial.length} chars)`)
}
