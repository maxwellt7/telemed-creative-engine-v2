import { anthropic, callClaudeJSON } from '../lib/anthropic.js'
import { db, offerProfiles, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq } from 'drizzle-orm'

interface Avatar {
  personaName: string
  specificConcern: string
  primaryObjection: string
  keyMessage: string
  emotionalTrigger: string
  trustBuilder: string
}

const SYSTEM_PROMPT = `You are a telemedicine avatar specialist. Build detailed psychographic profiles for all 15 telemedicine persona archetypes given an offer.

Return your avatars by calling the submit_avatars tool with an array of exactly 15 profiles.`

const AVATARS_SCHEMA = {
  type: 'object',
  properties: {
    avatars: {
      type: 'array',
      minItems: 15,
      maxItems: 15,
      items: {
        type: 'object',
        properties: {
          personaName: { type: 'string' },
          specificConcern: { type: 'string', description: 'their concern about THIS product specifically' },
          primaryObjection: { type: 'string', description: 'top reason NOT to buy' },
          keyMessage: { type: 'string', description: 'the single message that would most move them' },
          emotionalTrigger: { type: 'string' },
          trustBuilder: { type: 'string', description: 'what would make them trust this product' },
        },
        required: ['personaName', 'specificConcern', 'primaryObjection', 'keyMessage', 'emotionalTrigger', 'trustBuilder'],
      },
    },
  },
  required: ['avatars'],
}

export async function runAvatarAgent(runId: string) {
  await log(runId, 'AVATAR_BUILD', 'Building persona avatars')

  const [profile] = await db.select().from(offerProfiles).where(eq(offerProfiles.runId, runId))
  if (!profile) throw new Error(`No offer profile for run ${runId}`)

  const { avatars } = await callClaudeJSON<{ avatars: Avatar[] }>(anthropic, {
    model: 'claude-opus-4-7',
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Build avatar profiles for all 15 telemedicine personas for this offer:\n\n${JSON.stringify(profile.offerAnalysisJson, null, 2)}\n\nBeliefs:\n${JSON.stringify(profile.beliefsJson, null, 2)}`,
    }],
    maxTokens: 8192,
    tool: {
      name: 'submit_avatars',
      description: 'Submit the 15 persona avatar profiles',
      input_schema: AVATARS_SCHEMA,
    },
  })

  await db.update(offerProfiles).set({ avatarJson: avatars }).where(eq(offerProfiles.runId, runId))
  await db.update(pipelineRuns).set({ currentStage: 'COMPETITOR_DISCOVER' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'AVATAR_BUILD', `Built ${avatars.length} avatar profiles`)
}
