import { trpc } from '../lib/trpc'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const runs = await trpc.runs.list.query()

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111', margin: 0 }}>Pipeline Runs</h1>
        <Link href="/runs/new" style={{ background: '#0066CC', color: '#fff', padding: '0.5rem 1rem', borderRadius: 6, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}>
          + New Run
        </Link>
      </div>

      {runs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280', border: '2px dashed #e5e7eb', borderRadius: 12 }}>
          No runs yet. Start your first pipeline run.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {runs.map((run) => (
            <Link key={run.id} href={`/runs/${run.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#111', fontFamily: 'monospace', fontSize: '0.9rem' }}>{run.id.slice(0, 12)}…</div>
                  <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: 2 }}>Stage: {run.currentStage} {run.revisionPass > 0 ? `· Pass ${run.revisionPass}` : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 99, letterSpacing: '0.05em',
                    background: run.status === 'complete' ? '#dcfce7' : run.status === 'failed' ? '#fee2e2' : '#dbeafe',
                    color: run.status === 'complete' ? '#166534' : run.status === 'failed' ? '#991b1b' : '#1e40af',
                  }}>
                    {run.status.toUpperCase()}
                  </span>
                  <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                    {new Date(run.startedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
