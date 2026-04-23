import { trpc } from '../../lib/trpc'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AssetsPage({ params }: { params: { id: string } }) {
  const { copy, creative, funnel } = await trpc.runs.assets.query({ runId: params.id })

  const advertorials = copy.filter((c) => c.type === 'advertorial').sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
  const adScripts = copy.filter((c) => c.type === 'ad_script')
  const staticAds = creative.filter((c) => c.type === 'static_ad')
  const videos = creative.filter((c) => c.type === 'video_final' || c.type === 'video_draft').sort((a, b) => a.type.localeCompare(b.type))

  const sectionStyle = { marginBottom: '2.5rem' }
  const headingStyle = { fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#111' }

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Assets</h1>
        <Link href={`/runs/${params.id}`} style={{ color: '#0066CC', textDecoration: 'none', fontSize: '0.875rem' }}>← Back to run</Link>
      </div>

      {funnel[0]?.vercelUrl && (
        <div style={sectionStyle}>
          <h2 style={headingStyle}>Funnel Page</h2>
          <a href={funnel[0].vercelUrl} target="_blank" rel="noreferrer" style={{ color: '#0066CC', textDecoration: 'underline', fontSize: '0.9rem', wordBreak: 'break-all' }}>
            {funnel[0].vercelUrl}
          </a>
        </div>
      )}

      {advertorials.length > 0 && (
        <div style={sectionStyle}>
          <h2 style={headingStyle}>Advertorial <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#6b7280' }}>v{advertorials[0].version}</span></h2>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem', whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: 1.8, maxHeight: 450, overflowY: 'auto', color: '#111' }}>
            {advertorials[0].content}
          </div>
        </div>
      )}

      {adScripts.length > 0 && (
        <div style={sectionStyle}>
          <h2 style={headingStyle}>Ad Scripts</h2>
          <div style={{ background: '#1e293b', borderRadius: 8, padding: '1.25rem', fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: '#e2e8f0', maxHeight: 300, overflowY: 'auto' }}>
            {adScripts[0].content}
          </div>
        </div>
      )}

      {staticAds.length > 0 && (
        <div style={sectionStyle}>
          <h2 style={headingStyle}>Static Ads</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {staticAds.map((ad) => (
              <div key={ad.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                {ad.storageUrl && (
                  <img src={ad.storageUrl} alt={`${ad.format} static ad`} style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
                )}
                <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: '#6b7280', textAlign: 'center', fontWeight: 600 }}>{ad.format}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div style={sectionStyle}>
          <h2 style={headingStyle}>Videos</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {videos.map((v) => (
              <div key={v.id}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {v.type.replace(/_/g, ' ')}
                </div>
                {v.storageUrl && (
                  <video controls style={{ width: '100%', maxWidth: 480, borderRadius: 8, background: '#000' }}>
                    <source src={v.storageUrl} type="video/mp4" />
                  </video>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {advertorials.length === 0 && staticAds.length === 0 && videos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
          No assets generated yet. Run the pipeline first.
        </div>
      )}
    </main>
  )
}
