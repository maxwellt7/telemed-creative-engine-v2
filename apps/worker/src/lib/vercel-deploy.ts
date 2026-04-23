export async function deployAdvertorial(htmlContent: string, slug: string): Promise<string> {
  const res = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `telemed-adv-${slug}`,
      files: [{
        file: 'index.html',
        data: Buffer.from(htmlContent).toString('base64'),
        encoding: 'base64',
      }],
      projectSettings: { framework: null, outputDirectory: '.' },
      target: 'preview',
      teamId: process.env.VERCEL_TEAM_ID,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Vercel deploy failed: ${res.status} ${body}`)
  }
  const data = await res.json() as { url: string }
  return `https://${data.url}`
}
