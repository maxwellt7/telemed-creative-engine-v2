import { anthropic, callClaude, parseClaudeJson } from '../lib/anthropic.js'
import { db, offerProfiles, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq } from 'drizzle-orm'

export async function runManifoldAgent(runId: string) {
  await log(runId, 'MANIFOLD_BUILD', 'Running manifold psychological profile (5 nodes)')

  const [profile] = await db.select().from(offerProfiles).where(eq(offerProfiles.runId, runId))
  if (!profile) throw new Error(`No offer profile for run ${runId}`)

  const offer = profile.offerAnalysisJson as any
  const avatars = (profile.avatarJson as any[]) ?? []
  const primaryAvatar = avatars[0] ?? {}
  const beliefs = profile.beliefsJson as string[]
  const manifold = profile.manifoldJson as any
  const beliefCategories = manifold?.beliefCategories ?? {}

  // Node 1: Core Wound
  const node1 = parseClaudeJson(await callClaude(anthropic, {
    model: 'claude-opus-4-7',
    system: `You are a direct-response psychologist identifying the Core Wound — the deepest identity-level fear driving all surface-level problems for this telemedicine avatar. The Core Wound is rooted in identity or self-worth, often something the avatar doesn't consciously name but that drives every frustrated attempt to solve the problem. Respond ONLY with valid JSON: { "coreWound": "string (300-400 words describing the wound, how it formed, how it manifests)", "coreWoundOneLiner": "string — 1 sentence that captures it", "identityThreat": "string — the exact identity statement threatened (e.g. 'I am someone who has self-control')" }`,
    messages: [{ role: 'user', content: `Identify the Core Wound for this telemedicine weight loss avatar.\n\nOffer: ${offer.core_promise}\nTop Desire: ${primaryAvatar.topDesire ?? ''}\nTop Frustration: ${primaryAvatar.topFrustration ?? ''}\nPrevious Solutions Tried: ${(primaryAvatar.previousSolutions ?? []).join(', ')}\nFeelings: ${(primaryAvatar.empathyMap?.feeling ?? []).join(', ')}\nDeepest Fears: ${(primaryAvatar.goalsGrid?.fearsAndImplications ?? []).join(', ')}\nCore Beliefs: ${beliefs.slice(0, 5).join('; ')}` }],
    maxTokens: 1024,
  }))

  await log(runId, 'MANIFOLD_BUILD', `Node 1 complete: ${node1.coreWoundOneLiner}`)

  // Node 2: Language Patterns
  const node2 = parseClaudeJson(await callClaude(anthropic, {
    model: 'claude-sonnet-4-6',
    system: `You are a language pattern analyst. Extract the exact words, phrases, and vocabulary this avatar uses and responds to emotionally. Respond ONLY with valid JSON: { "exactPhrases": ["string x10 — exact phrases this person says or thinks about their weight problem"], "painLanguage": ["string x5 — specific words that capture their pain accurately"], "transformationLanguage": ["string x5 — words that describe the outcome they want"], "wordsToAvoid": ["string x10 — corporate, clinical, or AI-sounding words that immediately feel fake to them"] }`,
    messages: [{ role: 'user', content: `Extract language patterns for this avatar.\n\nWhat they say: ${(primaryAvatar.empathyMap?.saying ?? []).join('; ')}\nWhat they think: ${(primaryAvatar.empathyMap?.thinking ?? []).join('; ')}\nWhat they're doing: ${(primaryAvatar.empathyMap?.doing ?? []).join('; ')}\nPrevious solutions: ${(primaryAvatar.previousSolutions ?? []).join(', ')}\nCore Wound: ${node1.coreWound?.slice(0, 200)}` }],
    maxTokens: 1024,
  }))

  await log(runId, 'MANIFOLD_BUILD', `Node 2 complete: ${node2.exactPhrases?.length ?? 0} phrases`)

  // Node 3: Ejection Triggers
  const node3 = parseClaudeJson(await callClaude(anthropic, {
    model: 'claude-sonnet-4-6',
    system: `You are identifying Ejection Triggers — messaging landmines that cause this avatar to instantly reject and disengage. These are things a copywriter must NEVER say. Respond ONLY with valid JSON: { "triggers": [ { "trigger": "string — exact thing to never say or imply", "whyItEjects": "string — the psychological reason (1-2 sentences)", "doInstead": "string — the safe alternative approach" } ] } Generate exactly 10 triggers.`,
    messages: [{ role: 'user', content: `Identify 10 ejection triggers for this telemedicine weight loss avatar.\n\nCore Wound: ${node1.coreWoundOneLiner}\nIdentity Threatened: ${node1.identityThreat}\nWords to Avoid: ${(node2.wordsToAvoid ?? []).join(', ')}\nIdentity Beliefs: ${(beliefCategories.identity ?? []).join('; ')}\nCredibility Beliefs: ${(beliefCategories.credibility ?? []).join('; ')}\nPrevious Failed Solutions: ${(primaryAvatar.previousSolutions ?? []).join(', ')}` }],
    maxTokens: 1536,
  }))

  await log(runId, 'MANIFOLD_BUILD', `Node 3 complete: ${node3.triggers?.length ?? 0} ejection triggers`)

  // Node 4: Dissolution Frameworks
  const node4 = parseClaudeJson(await callClaude(anthropic, {
    model: 'claude-opus-4-7',
    system: `You are a belief dissolution strategist. For each of the 6 belief categories, identify the single strongest blocking belief and provide a complete dissolution framework. Respond ONLY with valid JSON: { "dissolutions": [ { "category": "outcome|identity|problem|solution|product|credibility", "blockingBelief": "string — the exact blocking belief", "reframe": "string — new perspective on this constraint", "evidence": "string — proof the constraint isn't absolute", "newStory": "string — empowering narrative to replace the limiting one", "epiphanySeed": "string — the single insight or question that creates breakthrough" } ] } Generate exactly 6 dissolutions (one per category).`,
    messages: [{ role: 'user', content: `Create dissolution frameworks for the 6 belief categories for this telemedicine weight loss avatar.\n\nCore Wound: ${node1.coreWoundOneLiner}\nBelief Categories:\n${Object.entries(beliefCategories).map(([k, v]) => `${k}: ${(v as string[]).join('; ')}`).join('\n')}\nKey Ejection Triggers: ${(node3.triggers ?? []).slice(0, 3).map((t: any) => t.trigger).join('; ')}` }],
    maxTokens: 2048,
  }))

  await log(runId, 'MANIFOLD_BUILD', `Node 4 complete: ${node4.dissolutions?.length ?? 0} dissolutions`)

  // Node 5: Hooks (Maze Theory)
  const node5 = parseClaudeJson(await callClaude(anthropic, {
    model: 'claude-sonnet-4-6',
    system: `You are a hook strategist using Maze Theory. Generate 10 hooks that promise revelation, create curiosity gaps, challenge existing beliefs, or hint at a new mechanism. Each hook must be in the "sweet spot" of believability — surprising but credible (not too far a leap). Respond ONLY with valid JSON: { "hooks": [ { "hook": "string — the opening 1-2 sentences", "openerType": "internalDialogue|whyProblem|whyContrast|howOthersSucceed|caseStudy|secret|safety|realReason|whenLastTime", "whyItWorks": "string — the psychological reason in 1 sentence" } ] }`,
    messages: [{ role: 'user', content: `Generate 10 hooks for a telemedicine GLP-1 weight loss advertorial.\n\nCore Wound: ${node1.coreWoundOneLiner}\nExact Phrases They Use: ${(node2.exactPhrases ?? []).slice(0, 5).join('; ')}\nKey Dissolutions (epiphany seeds): ${(node4.dissolutions ?? []).map((d: any) => d.epiphanySeed).join('; ')}\nOffer Mechanism: ${offer.mechanism}\nCore Promise: ${offer.core_promise}` }],
    maxTokens: 1024,
  }))

  await log(runId, 'MANIFOLD_BUILD', `Node 5 complete: ${node5.hooks?.length ?? 0} hooks`)

  const manifoldDeep = {
    coreWound: node1,
    languagePatterns: node2,
    ejectionTriggers: node3,
    dissolutions: node4,
    hooks: node5,
  }

  await db.update(offerProfiles)
    .set({ manifoldDeepJson: manifoldDeep as any })
    .where(eq(offerProfiles.runId, runId))

  await db.update(pipelineRuns)
    .set({ currentStage: 'COMPETITOR_DISCOVER' })
    .where(eq(pipelineRuns.id, runId))

  await log(runId, 'MANIFOLD_BUILD', 'Manifold complete — coreWound, languagePatterns, ejectionTriggers, dissolutions, hooks stored')
}
