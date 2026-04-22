import { describe, it, expect } from 'vitest'
import { PIPELINE_STAGES, StartRunInputSchema } from './types'

describe('shared types', () => {
  it('PIPELINE_STAGES has 21 entries', () => {
    expect(PIPELINE_STAGES.length).toBe(21)
  })

  it('StartRunInputSchema validates correctly', () => {
    const result = StartRunInputSchema.safeParse({
      productName: 'Hims ED',
      productUrl: 'https://hims.com',
      targetMarket: 'US men 35-55',
      brief: 'ED telemedicine brand',
    })
    expect(result.success).toBe(true)
  })

  it('StartRunInputSchema rejects missing fields', () => {
    const result = StartRunInputSchema.safeParse({ productName: 'test' })
    expect(result.success).toBe(false)
  })
})
