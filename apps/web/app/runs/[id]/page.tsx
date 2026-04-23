'use client'
import { use, useEffect, useState } from 'react'
import { trpc } from '../../lib/trpc'

const STAGES = ['INTAKE','OFFER_PROFILE','AVATAR_BUILD','COMPETITOR_DISCOVER','ADVERTORIAL_DISCOVER','ADVERTORIAL_FETCH','REVERSE_ENGINEER','REVERSE_BRIEF','COPY_CONCEPTS','ADVERTORIAL_COPY','CREATIVE_DIRECTION','AD_SCRIPTS','FUNNEL_BUILD','STATIC_ADS','VIDEO_DRAFT','VIDEO_FINAL','PERSONA_TEST','FEEDBACK_AGGREGATE','REVISION','QA_FINAL','DELIVERY']

type Run = Awaited<ReturnType<typeof trpc.runs.get.query>>
type Log = Awaited<ReturnType<typeof trpc.runs.logs.query>>[number]

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [run, setRun] = useState<Run | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function refresh() {
      try {
        const [r, l] = await Promise.all([
          trpc.runs.get.query({ runId: id }),
          trpc.runs.logs.query({ runId: id }),
        ])
        setRun(r)
        setLogs(l)
      } catch { /* ignore polling errors */ }
      finally { setLoading(false) }
    }
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [id])

  if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading…</div>
  if (!run) return <div style={{ padding: '2rem', color: '#dc2626' }}>Run not found</div>

  const stageIdx = STAGES.indexOf(run.currentStage)
  const isActive = run.status === 'running'

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, fontFamily: 'monospace' }}>Run {run.id.slice(0, 16)}…</h1>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>
            {run.revisionPass > 0 && `Revision pass ${run.revisionPass} · `}
            Started {new Date(run.startedAt).toLocaleString()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {run.status === 'complete' && (
            <a href={`/assets/${run.id}`} style={{ background: '#0066CC', color: '#fff', padding: '0.4rem 0.9rem', borderRadius: 6, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}>
              View Assets →
            </a>
          )}
          <span style={{
            padding: '0.3rem 0.8rem', borderRadius: 99, fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.05em',
            background: run.status === 'complete' ? '#dcfce7' : run.status === 'failed' ? '#fee2e2' : '#dbeafe',
            color: run.status === 'complete' ? '#166534' : run.status === 'failed' ? '#991b1b' : '#1e40af',
          }}>
            {run.status.toUpperCase()} {isActive && '●'}
          </span>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 3, minWidth: 'max-content' }}>
          {STAGES.map((stage, i) => (
            <div key={stage} title={stage} style={{
              padding: '0.25rem 0.4rem', borderRadius: 4, fontSize: '0.6rem', fontWeight: 600, whiteSpace: 'nowrap',
              background: i < stageIdx ? '#dcfce7' : i === stageIdx ? '#dbeafe' : '#f3f4f6',
              color: i < stageIdx ? '#166534' : i === stageIdx ? '#1e40af' : '#9ca3af',
            }}>
              {stage.replace(/_/g, ' ')}
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#0f172a', borderRadius: 8, padding: '1.25rem', fontFamily: 'monospace', fontSize: '0.78rem', maxHeight: 520, overflowY: 'auto', lineHeight: 1.6 }}>
        {logs.length === 0 ? (
          <div style={{ color: '#475569' }}>Waiting for logs…</div>
        ) : (
          logs.map((l) => (
            <div key={l.id} style={{ color: l.level === 'error' ? '#f87171' : l.level === 'warn' ? '#fbbf24' : '#86efac', marginBottom: 2 }}>
              <span style={{ color: '#475569' }}>[{new Date(l.createdAt).toLocaleTimeString()}]</span>
              {' '}
              <span style={{ color: '#93c5fd' }}>[{l.stage}]</span>
              {' '}
              {l.message}
            </div>
          ))
        )}
      </div>
    </main>
  )
}
