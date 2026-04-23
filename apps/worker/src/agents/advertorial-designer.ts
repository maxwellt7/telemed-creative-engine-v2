import { callGeminiText, callGeminiImage, isGeminiConfigured } from '../lib/gemini.js'
import { uploadImage } from '../lib/storage.js'
import { db, offerProfiles, reverseBriefs, creativeAssets, advertorialDesigns, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and } from 'drizzle-orm'

interface DesignPlan {
  heroPrompt: string
  heroAlt: string
  sections: Array<{ slot: string; prompt: string; alt: string; aspectRatio: '1:1' | '4:5' | '16:9' }>
  ctaImagePrompt: string
  ctaAlt: string
  colorPalette: string[]
  typographyPairing: string
  visualMood: string
}

const DESIGN_DIRECTOR_SYSTEM = `You are an art director for direct-response telemedicine advertorials.
Given the offer profile, reverse brief, and chosen copy concept, produce a visual design plan as JSON.

Return ONLY valid JSON matching this structure exactly:
{
  "heroPrompt": "string — detailed Flux/Imagen-style generation prompt for the hero image",
  "heroAlt": "string — alt text",
  "sections": [
    { "slot": "section1", "prompt": "string", "alt": "string", "aspectRatio": "16:9" },
    { "slot": "section2", "prompt": "string", "alt": "string", "aspectRatio": "1:1" },
    { "slot": "section3", "prompt": "string", "alt": "string", "aspectRatio": "4:5" }
  ],
  "ctaImagePrompt": "string",
  "ctaAlt": "string",
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "typographyPairing": "string — e.g. Playfair Display + Inter",
  "visualMood": "string — 1-2 sentences describing overall visual direction"
}

Each image prompt must describe subject, setting, lighting, composition, and mood in detail.
People depicted must look authentically relatable and age-appropriate for the avatar — not stock-photo-generic.
No markdown fences. Return raw JSON only.`

export async function runAdvertorialDesign(runId: string) {
  await log(runId, 'ADVERTORIAL_DESIGN', 'Planning advertorial visual design')

  if (!isGeminiConfigured()) {
    await log(runId, 'ADVERTORIAL_DESIGN', 'GEMINI_API_KEY not set — skipping design stage', 'warn')
    await db.update(pipelineRuns).set({ currentStage: 'ADVERTORIAL_COPY' }).where(eq(pipelineRuns.id, runId))
    return
  }

  const [profile] = await db.select().from(offerProfiles).where(eq(offerProfiles.runId, runId))
  const [brief] = await db.select().from(reverseBriefs).where(eq(reverseBriefs.runId, runId))
  if (!brief) throw new Error(`No reverse brief for run ${runId}`)

  const concepts = (brief.conceptsJson as any[]) ?? []
  const primary = concepts[0] ?? {}

  let plan: DesignPlan
  try {
    const planText = await callGeminiText({
      system: DESIGN_DIRECTOR_SYSTEM,
      prompt: `Offer analysis: ${JSON.stringify(profile?.offerAnalysisJson ?? {})}\n\nAvatar: ${JSON.stringify(profile?.avatarJson ?? {})}\n\nBrief: ${JSON.stringify(brief.briefJson)}\n\nPrimary concept: ${JSON.stringify(primary)}\n\nReturn the design plan JSON now.`,
      maxOutputTokens: 2048,
      temperature: 0.8,
    })
    const stripped = planText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
    plan = JSON.parse(stripped) as DesignPlan
  } catch (err) {
    await log(runId, 'ADVERTORIAL_DESIGN', `Design plan failed (${(err as Error).message}) — skipping`, 'warn')
    await db.update(pipelineRuns).set({ currentStage: 'ADVERTORIAL_COPY' }).where(eq(pipelineRuns.id, runId))
    return
  }

  const imageSlots = [
    { slot: 'hero', prompt: plan.heroPrompt, aspectRatio: '16:9' as const, alt: plan.heroAlt },
    ...(plan.sections ?? []).map((s) => ({ slot: s.slot, prompt: s.prompt, aspectRatio: s.aspectRatio, alt: s.alt })),
    { slot: 'cta', prompt: plan.ctaImagePrompt, aspectRatio: '4:5' as const, alt: plan.ctaAlt },
  ]

  const results: Array<{ slot: string; url: string; alt: string; aspectRatio: string; prompt: string }> = []

  await Promise.all(imageSlots.map(async (p) => {
    try {
      const { imageBase64, mimeType } = await callGeminiImage({
        prompt: p.prompt,
        aspectRatio: p.aspectRatio,
      })
      const ext = mimeType.split('/')[1] ?? 'jpg'
      const url = await uploadImage(`run-${runId}/advertorial/${p.slot}.${ext}`, imageBase64, mimeType)
      await db.insert(creativeAssets).values({
        runId,
        type: 'advertorial_design',
        storageUrl: url,
        format: p.aspectRatio,
        status: 'ready',
      })
      results.push({ slot: p.slot, url, alt: p.alt, aspectRatio: p.aspectRatio, prompt: p.prompt })
      await log(runId, 'ADVERTORIAL_DESIGN', `Generated ${p.slot} image: ${url}`)
    } catch (err) {
      await log(runId, 'ADVERTORIAL_DESIGN', `Image gen failed for ${p.slot} (${(err as Error).message}) — skipping slot`, 'warn')
    }
  }))

  await db.insert(advertorialDesigns).values({
    runId,
    planJson: plan as any,
    assetsJson: results as any,
    colorPaletteJson: (plan.colorPalette ?? []) as any,
    typographyPairing: plan.typographyPairing,
  })

  await db.update(pipelineRuns).set({ currentStage: 'ADVERTORIAL_COPY' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'ADVERTORIAL_DESIGN', `Visual design complete — ${results.length}/${imageSlots.length} images generated`)
}
