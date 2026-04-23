import { anthropic, callClaude } from '../lib/anthropic.js'
import { deployAdvertorial } from '../lib/vercel-deploy.js'
import { db, copyAssets, funnelPages, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and } from 'drizzle-orm'

const FUNNEL_SYSTEM = `You are an expert direct-response web developer. Convert this advertorial into a single-page HTML funnel.

Requirements:
- Mobile-first, fully responsive (CSS Grid/Flexbox, no frameworks)
- Strong above-fold H1 + subheadline visible without scrolling
- Multiple CTA buttons: top (after headline), middle (after proof), bottom (after urgency)
- Social proof section with 3 testimonials (use plausible names and results)
- Urgency element: "Only 47 spots remaining this month"
- Trust signals: board-certified doctor badge, HIPAA compliant badge, money-back guarantee
- No header navigation links
- Colors: #0066CC (medical blue), #00A651 (CTA green), white, #f8f9fa (bg)
- Inline CSS only — no external stylesheets

Output ONLY valid HTML starting with <!DOCTYPE html>. No markdown, no explanation.`

export async function runFunnelBuilder(runId: string) {
  await log(runId, 'FUNNEL_BUILD', 'Building advertorial funnel page')

  const [advertorial] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'advertorial')))

  if (!advertorial) throw new Error(`No advertorial for run ${runId}`)

  const html = await callClaude(anthropic, {
    model: 'claude-sonnet-4-6',
    system: FUNNEL_SYSTEM,
    messages: [{
      role: 'user',
      content: `Convert this advertorial into a complete HTML funnel:\n\n${advertorial.content}`,
    }],
    maxTokens: 8192,
  })

  const slug = `${runId.slice(0, 8)}-${Date.now()}`
  const vercelUrl = await deployAdvertorial(html, slug)

  await db.insert(funnelPages).values({
    runId, htmlContent: html, vercelUrl, status: 'deployed',
  })

  await db.update(pipelineRuns).set({ currentStage: 'STATIC_ADS' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'FUNNEL_BUILD', `Funnel deployed: ${vercelUrl}`)
}
