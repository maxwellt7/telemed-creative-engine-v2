import { anthropic, callClaude, parseClaudeJson } from '../lib/anthropic.js'
import { db, copyAssets, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and } from 'drizzle-orm'

const CREATIVE_DIRECTION_SYSTEM = `You are a telemedicine creative director. Analyze the advertorial and generate 3 distinct video ad concepts.

Respond ONLY with valid JSON — array of exactly 3:
[
  {
    "concept": "string",
    "visual": "string — opening shot description",
    "emotion": "string — primary emotion driven",
    "format": "testimonial | demo | problem-solution | authority | before-after",
    "targetPersona": "string — persona from the 15 archetypes",
    "hook": "string — opening 5 seconds description",
    "valueProposition": "string"
  }
]`

const AD_SCRIPTS_SYSTEM = `You are a telemedicine video ad scriptwriter trained in Belief Engineering methodology. Your job is to write scripts that move the prospect from Closed State (guarded, skeptical) to Receptive State (open, curious) BEFORE attempting to introduce the product.

## THE SIX AD STRUCTURES

1. **Belief Shifter / Root Cause** — Challenges a common misconception about the cause of the problem. Opens with "What's the biggest misconception about [PROBLEM]? That [FALSE BELIEF]..."

2. **Why What How** — Identifies struggle, offers a simple fix, explains the mechanism. Opens by capturing internal dialogue or asking the struggle question directly.

3. **Hate / Story** — Vulnerable personal story from the protagonist, leading to discovery. Opens with direct emotional statement + story beginning.

4. **Why Root Cause / Outcome** — "Why are [target audience] struggling to [solve problem]?" Lists what they've tried → Fatal Flaw → solution. Best for showing the hidden cause.

5. **Internal Dialogue / Story** — First-person emotional story from the prospect's perspective. Deep vulnerability, failed attempts, discovery moment, invitation.

6. **Remove the Retreat** — Challenges the "safe" inaction path. Shows what they're really risking by NOT acting. Reframes the risk calculation.

## THE NINE OPENER TYPES

- **internalDialogue**: Captures their private thoughts. Use for deep shame/emotional pain.
- **whyProblem**: "Why are [target audience] struggling to [get outcome]?" Use when problem is widespread.
- **whyContrast**: Highlights the unfair disparity between those succeeding vs struggling.
- **howOthersSucceed**: "How are [people like them] achieving [outcome]?" Builds outcome + identity beliefs.
- **caseStudy**: Leads with a specific real result. "Wayne lost 15 lbs in 4 weeks with THIS."
- **secret**: Implies insider knowledge. Use when mechanism is unknown or counterintuitive.
- **safety**: Introduces a hidden danger they haven't considered.
- **realReason**: "What's the REAL reason [problem] isn't [what they think]?" Use for Fatal Flaw strategy.
- **whenLastTime**: "When was the last time [positive state]?" Anchors in their frustration.

## VOICE RULES — NON-NEGOTIABLE

DO: contractions, short sentences (1-3 words ideal for VO), specific names/numbers/places, "..." for natural pauses
DO NOT: "delve", "unlock", "journey", "game-changer", "revolutionary", "transformative", "leverage", "elevate"
VO lines must sound like a real person speaking — read each line aloud mentally

## SCRIPT FORMAT

Each line must be prefixed:
- VO: [voiceover line]
- OPEN: / CUT: / SCENE: [visual direction]
- SUPER: [on-screen text]

Respond ONLY with valid JSON — array matching input concepts:
[
  {
    "concept": "string — same name as input",
    "adStructure": "string — which of the 6 structures used",
    "openerTypeUsed": "string — which opener type used",
    "blockingBeliefsAddressed": ["string x2 — which blocking beliefs this script dissolves"],
    "script30s": "string — full shooting script with VO:, OPEN:, SUPER: lines",
    "script60s": "string — extended 60s version",
    "staticAdHeadline": "string — passes the Dan Kennedy test: would someone respond if this appeared in a classified ad with just a phone number?",
    "staticAdBody": "string — 2-3 sentences using Fatal Flaw or Core Wound language",
    "imagePrompt": "string — Flux image generation prompt for the hero static ad image"
  }
]`

export async function runCreativeDirection(runId: string) {
  await log(runId, 'CREATIVE_DIRECTION', 'Generating creative concepts')

  const [advertorial] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'advertorial')))

  if (!advertorial) throw new Error(`No advertorial for run ${runId}`)

  const concepts = await callClaude(anthropic, {
    model: 'claude-opus-4-7',
    system: CREATIVE_DIRECTION_SYSTEM,
    messages: [{
      role: 'user',
      content: `Generate 3 video ad concepts from this advertorial:\n\n${advertorial.content.slice(0, 8000)}`,
    }],
    maxTokens: 4096,
    thinkingBudget: 2000,
  })

  const parsed = parseClaudeJson(concepts)
  await db.insert(copyAssets).values({
    runId, type: 'concept_brief', content: JSON.stringify(parsed), version: 1, status: 'draft',
  })

  await db.update(pipelineRuns).set({ currentStage: 'AD_SCRIPTS' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'CREATIVE_DIRECTION', `Generated ${parsed.length} creative concepts`)
}

export async function runAdScripts(runId: string) {
  await log(runId, 'AD_SCRIPTS', 'Writing ad scripts')

  const [conceptBrief] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'concept_brief')))

  if (!conceptBrief) throw new Error(`No concept brief for run ${runId}`)

  const parsed = parseClaudeJson(conceptBrief.content)
  const conceptsWithContext = (parsed ?? []).map((c: any) => ({
    ...c,
    openerInstruction: `Use the "${c.openerType ?? 'whyProblem'}" opener type for this concept's script.`,
  }))

  const scripts = await callClaude(anthropic, {
    model: 'claude-sonnet-4-6',
    system: AD_SCRIPTS_SYSTEM,
    messages: [{
      role: 'user',
      content: `Write full ad scripts for these concepts. For each concept, use the openerType field to select the correct opener.

CONCEPTS:
${JSON.stringify(conceptsWithContext, null, 2)}`,
    }],
    maxTokens: 8192,
  })

  const parsedScripts = parseClaudeJson(scripts)
  await db.insert(copyAssets).values({
    runId, type: 'ad_script', content: JSON.stringify(parsedScripts), version: 1, status: 'draft',
  })

  await db.update(pipelineRuns).set({ currentStage: 'FUNNEL_BUILD' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'AD_SCRIPTS', `Wrote scripts for ${parsedScripts.length} concepts`)
}
