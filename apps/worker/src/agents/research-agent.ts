import { searchExa } from '../lib/exa.js'
import { db, researchArtifacts, offerProfiles, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq } from 'drizzle-orm'

interface ProductContext { name: string; url: string; targetMarket: string }

export async function runCompetitorDiscover(runId: string, product: ProductContext) {
  await log(runId, 'COMPETITOR_DISCOVER', `Discovering competitors for ${product.name}`)

  const query = `telemedicine ${product.name} competitors online doctor prescription ${product.targetMarket} site:*.com`
  const results = await searchExa(query, 7)
  const competitors = results.filter((r) => !r.url.includes(product.url.replace('https://', '')))

  await db.insert(researchArtifacts).values(
    competitors.map((r) => ({
      runId,
      type: 'competitor',
      url: r.url,
      title: r.title,
      trafficScore: r.score,
      rawContent: r.text.slice(0, 5000),
      analysisJson: null,
    }))
  )

  await db.update(pipelineRuns).set({ currentStage: 'ADVERTORIAL_DISCOVER' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'COMPETITOR_DISCOVER', `Found ${competitors.length} competitors`)
}

export async function runAdvertorialDiscover(runId: string, product: ProductContext) {
  await log(runId, 'ADVERTORIAL_DISCOVER', 'Discovering competitor advertorials')

  const [profile] = await db.select().from(offerProfiles).where(eq(offerProfiles.runId, runId))
  const corePromise = (profile?.offerAnalysisJson as { core_promise?: string })?.core_promise ?? product.name

  const query = `advertorial "sponsored" telemedicine ${corePromise} native advertising health`
  const results = await searchExa(query, 5)

  const advertorials = results.filter((r) =>
    r.url !== product.url &&
    (r.text.toLowerCase().includes('sponsored') ||
     r.text.toLowerCase().includes('advertorial') ||
     r.text.length > 2000)
  )

  if (advertorials.length > 0) {
    await db.insert(researchArtifacts).values(
      advertorials.map((r) => ({
        runId,
        type: 'advertorial',
        url: r.url,
        title: r.title,
        trafficScore: r.score,
        rawContent: r.text.slice(0, 5000),
        analysisJson: null,
      }))
    )
  }

  await db.update(pipelineRuns).set({ currentStage: 'ADVERTORIAL_FETCH' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'ADVERTORIAL_DISCOVER', `Found ${advertorials.length} advertorials`)
}
