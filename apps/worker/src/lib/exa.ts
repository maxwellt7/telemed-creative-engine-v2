import { Exa } from 'exa-js'

export const exa = new Exa(process.env.EXA_API_KEY!)

export async function searchExa(query: string, numResults = 5) {
  const result = await exa.searchAndContents(query, {
    numResults,
    useAutoprompt: true,
    type: 'neural',
  })
  return result.results.map((r: any) => ({
    url: r.url,
    title: r.title ?? '',
    text: r.text ?? '',
    score: r.score ?? 0,
  }))
}
