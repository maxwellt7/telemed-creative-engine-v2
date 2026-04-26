import { describe, it, expect } from 'vitest'
import { products, pipelineRuns, stageLogs, personas, offerProfiles } from './schema.js'

describe('database schema', () => {
  it('products table has vertical default telemedicine', () => {
    expect((products.vertical as any).default).toBe('telemedicine')
  })

  it('pipelineRuns has status default pending', () => {
    expect((pipelineRuns.status as any).default).toBe('pending')
    expect((pipelineRuns.revisionPass as any).default).toBe(0)
  })

  it('personas table has primaryFear column', () => {
    expect(personas.primaryFear.name).toBe('primary_fear')
  })

  it('offerProfiles table has manifoldDeepJson column', () => {
    const cols = Object.keys(offerProfiles)
    expect(cols).toContain('manifoldDeepJson')
  })
})
