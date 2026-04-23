import FirecrawlApp from '@mendable/firecrawl-js'

export const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })

export async function scrapeUrl(url: string): Promise<string> {
  const result = await firecrawl.scrapeUrl(url, { formats: ['markdown'] })
  if (!result.success) throw new Error(`Firecrawl failed for ${url}: ${result.error}`)
  return (result as any).markdown ?? ''
}
