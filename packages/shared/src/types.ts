import { z } from 'zod'

export const PIPELINE_STAGES = [
  'INTAKE',
  'OFFER_PROFILE',
  'AVATAR_BUILD',
  'COMPETITOR_DISCOVER',
  'ADVERTORIAL_DISCOVER',
  'ADVERTORIAL_FETCH',
  'REVERSE_ENGINEER',
  'REVERSE_BRIEF',
  'COPY_CONCEPTS',
  'ADVERTORIAL_COPY',
  'CREATIVE_DIRECTION',
  'AD_SCRIPTS',
  'FUNNEL_BUILD',
  'STATIC_ADS',
  'VIDEO_DRAFT',
  'VIDEO_FINAL',
  'PERSONA_TEST',
  'FEEDBACK_AGGREGATE',
  'REVISION',
  'QA_FINAL',
  'DELIVERY',
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]
export type RunStatus = 'pending' | 'running' | 'paused' | 'complete' | 'failed'
export type AssetType =
  | 'advertorial'
  | 'static_ad'
  | 'video_draft'
  | 'video_final'
  | 'funnel_page'
  | 'ad_script'
  | 'concept_brief'
export type LogLevel = 'info' | 'warn' | 'error'

export const StartRunInputSchema = z.object({
  productName: z.string().min(1),
  productUrl: z.string().url(),
  targetMarket: z.string().min(1),
  brief: z.string().min(1),
})
export type StartRunInput = z.infer<typeof StartRunInputSchema>

export interface Product {
  id: string
  name: string
  url: string
  targetMarket: string
  brief: string
  vertical: string
  createdBy: string
  createdAt: Date
}

export interface PipelineRun {
  id: string
  productId: string
  status: RunStatus
  currentStage: PipelineStage
  revisionPass: number
  startedAt: Date
  completedAt: Date | null
  createdBy: string
}

export interface StageLog {
  id: string
  runId: string
  stage: PipelineStage
  level: LogLevel
  message: string
  metadataJson: Record<string, unknown> | null
  createdAt: Date
}
