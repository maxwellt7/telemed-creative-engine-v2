import { callGeminiText, isGeminiConfigured } from '../lib/gemini.js'
import { generateAdvertorialImage, isFalConfigured } from '../lib/fal.js'
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

  // Need at least one image provider configured
  if (!isGeminiConfigured() && !isFalConfigured()) {
    await log(runId, 'ADVERTORIAL_DESIGN', 'No image provider configured (need GEMINI_API_KEY or FAL_KEY) — skipping design stage', 'warn')
    await db.update(pipelineRuns).set({ currentStage: 'ADVERTORIAL_COPY' }).where(eq(pipelineRuns.id, runId))
    return
  }

  const [profile] = await db.select().from(offerProfiles).where(eq(offerProfiles.runId, runId))
  const [brief] = await db.select().from(reverseBriefs).where(eq(reverseBriefs.runId, runId))
  if (!brief) throw new Error(`No reverse brief for run ${runId}`)

  const concepts = (brief.conceptsJson as any[]) ?? []
  const primary = concepts[0] ?? {}

  // Step 1: Generate the design plan via Gemini text (or skip if not configured)
  let plan: DesignPlan
  if (isGeminiConfigured()) {
    try {
      const planText = await callGeminiText({
        system: DESIGN_DIRECTOR_SYSTEM,
        prompt: `Offer analysis: ${JSON.stringify(profile?.offerAnalysisJson ?? {})}\n\nAvatar: ${JSON.stringify(profile?.avatarJson ?? {})}\n\nBrief: ${JSON.stringify(brief.briefJson)}\n\nPrimary concept: ${JSON.stringify(primary)}\n\nReturn the design plan JSON now.`,
        maxOutputTokens: 4096,
        temperature: 0.8,
      })
      const stripped = planText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
      const jsonStart = stripped.indexOf('{')
      const jsonEnd = stripped.lastIndexOf('}')
      const jsonStr = jsonStart >= 0 && jsonEnd > jsonStart ? stripped.slice(jsonStart, jsonEnd + 1) : stripped
      plan = JSON.parse(jsonStr) as DesignPlan
    } catch (err) {
      await log(runId, 'ADVERTORIAL_DESIGN', `Design plan failed (${(err as Error).message}) — skipping`, 'warn')
      await db.update(pipelineRuns).set({ currentStage: 'ADVERTORIAL_COPY' }).where(eq(pipelineRuns.id, runId))
      return
    }
  } else {
    await log(runId, 'ADVERTORIAL_DESIGN', 'GEMINI_API_KEY not set — skipping design plan (Fal-only mode)', 'warn')
    await db.update(pipelineRuns).set({ currentStage: 'ADVERTORIAL_COPY' }).where(eq(pipelineRuns.id, runId))
    return
  }

  // Step 2: Generate images for each slot — try Fal.ai first, fall back to Gemini
  const imageSlots = [
    { slot: 'hero', prompt: plan.heroPrompt, aspectRatio: '16:9' as const, alt: plan.heroAlt },
    ...(plan.sections ?? []).map((s) => ({ slot: s.slot, prompt: s.prompt, aspectRatio: s.aspectRatio, alt: s.alt })),
    { slot: 'cta', prompt: plan.ctaImagePrompt, aspectRatio: '4:5' as const, alt: plan.ctaAlt },
  ]

  const results: Array<{ slot: string; url: string; alt: string; aspectRatio: string; prompt: string }> = []

  await Promise.all(imageSlots.map(async (p) => {
    try {
      let url: string

      if (!isFalConfigured()) {
        await log(runId, 'ADVERTORIAL_DESIGN', `FAL_KEY not set — skipping ${p.slot}`, 'warn')
        return
      }
      url = await generateAdvertorialImage(p.prompt, p.aspectRatio)
      await log(runId, 'ADVERTORIAL_DESIGN', `Generated ${p.slot} via Fal.ai: ${url}`)

      await db.insert(creativeAssets).values({
        runId,
        type: 'advertorial_design',
        storageUrl: url,
        format: p.aspectRatio,
        status: 'ready',
      })
      results.push({ slot: p.slot, url, alt: p.alt, aspectRatio: p.aspectRatio, prompt: p.prompt })
    } catch (err) {
      await log(runId, 'ADVERTORIAL_DESIGN', `Image gen failed for ${p.slot} (${(err as Error).message}) — skipping slot`, 'warn')
    }
  }))

  // Step 3: Store the design record — wrapped in try/catch so a DB issue doesn't crash the pipeline
  try {
    await db.insert(advertorialDesigns).values({
      runId,
      planJson: plan as any,
      assetsJson: results as any,
      colorPaletteJson: (plan.colorPalette ?? []) as any,
      typographyPairing: plan.typographyPairing,
    })
  } catch (err) {
    // If the advertorial_designs table doesn't exist or insert fails, log but don't crash
    // The pipeline can continue — the copy chief will just work without design context
    await log(runId, 'ADVERTORIAL_DESIGN', `Failed to save design record: ${(err as Error).message} — continuing without design context`, 'warn')
  }

  await db.update(pipelineRuns).set({ currentStage: 'ADVERTORIAL_COPY' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'ADVERTORIAL_DESIGN', `Visual design complete — ${results.length}/${imageSlots.length} images generated`)
}
