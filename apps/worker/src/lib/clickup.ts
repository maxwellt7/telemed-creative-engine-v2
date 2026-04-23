const BASE = 'https://api.clickup.com/api/v2'

async function cuFetch(path: string, method: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: process.env.CLICKUP_API_TOKEN!,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`ClickUp ${method} ${path} → ${res.status}`)
  const data = await res.json() as { id: string; url?: string }
  return { id: data.id, url: data.url ?? `https://app.clickup.com/t/${data.id}` }
}

export async function createAdvertorialTask(params: {
  productName: string
  advertorialUrl: string
  copyDocContent: string
  avgPersonaScore: number
}) {
  return cuFetch(`/list/${process.env.CLICKUP_ADVERTORIAL_LIST_ID}/task`, 'POST', {
    name: `[AI] ${params.productName} — Advertorial`,
    status: 'Drafting',
    description: `Advertorial: ${params.advertorialUrl}\nAvg Persona Score: ${params.avgPersonaScore.toFixed(1)}/10\n\n---\n\n${params.copyDocContent}`,
  })
}

export async function createCreativeTask(params: {
  productName: string
  assetType: string
  storageUrl: string
  format?: string
}) {
  return cuFetch(`/list/${process.env.CLICKUP_CREATIVE_LIST_ID}/task`, 'POST', {
    name: `[AI] ${params.productName} — ${params.assetType}${params.format ? ` (${params.format})` : ''}`,
    status: 'AI Generation',
    description: `Asset URL: ${params.storageUrl}`,
  })
}
