import { anthropic, callClaude, parseClaudeJson } from '../lib/anthropic.js'
import { db, offerProfiles, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq } from 'drizzle-orm'

const SYSTEM_PROMPT = `You are a telemedicine avatar specialist. Build detailed psychographic profiles for all 15 telemedicine persona archetypes given an offer.

Respond ONLY with valid JSON: an array of 15 objects, each with:
{
  "personaName": "string",
  "specificConcern": "string — their concern about THIS product specifically",
  "primaryObjection": "string — top reason NOT to buy",
  "keyMessage": "string — the single message that would most move them",
  "emotionalTrigger": "string",
  "trustBuilder": "string — what would make them trust this product"
}`

export async function runAvatarAgent(runId: string) {
  await log(runId, 'AVATAR_BUILD', 'Building persona avatars')

  const [profile] = await db.select().from(offerProfiles).where(eq(offerProfiles.runId, runId))
  if (!profile) throw new Error(`No offer profile for run ${runId}`)

  const text = await callClaude(anthropic, {
    model: 'claude-opus-4-7',
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Build avatar profiles for all 15 telemedicine personas for this offer:\n\n${JSON.stringify(profile.offerAnalysisJson, null, 2)}\n\nBeliefs:\n${JSON.stringify(profile.beliefsJson, null, 2)}`,
    }],
    maxTokens: 8192,
  })

  const avatars = parseClaudeJson(text)
  await db.update(offerProfiles).set({ avatarJson: avatars }).where(eq(offerProfiles.runId, runId))
  await db.update(pipelineRuns).set({ currentStage: 'COMPETITOR_DISCOVER' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'AVATAR_BUILD', `Built ${avatars.length} avatar profiles`)
}
