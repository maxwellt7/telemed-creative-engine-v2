'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '../../lib/trpc'

type FormState = { productName: string; productUrl: string; targetMarket: string; brief: string }

export default function NewRunPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>({ productName: '', productUrl: '', targetMarket: '', brief: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { runId } = await trpc.runs.start.mutate(form)
      router.push(`/runs/${runId}`)
    } catch (err) {
      setError(String(err))
      setLoading(false)
    }
  }

  const inputStyle = { width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem', boxSizing: 'border-box' as const }
  const labelStyle = { display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.875rem', color: '#374151' }

  return (
    <main style={{ maxWidth: 560, margin: '4rem auto', padding: '0 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>New Pipeline Run</h1>
        <a href="/dashboard" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Dashboard</a>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={labelStyle}>Product Name</label>
          <input value={form.productName} onChange={set('productName')} placeholder="e.g. Hims ED" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Product URL</label>
          <input value={form.productUrl} onChange={set('productUrl')} placeholder="https://forhims.com/ed" type="url" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Target Market</label>
          <input value={form.targetMarket} onChange={set('targetMarket')} placeholder="US men 35-55" required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Product Brief</label>
          <textarea value={form.brief} onChange={set('brief')} placeholder="Describe the product, its unique mechanism, and primary selling points" required rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: '0.875rem', background: '#fef2f2', padding: '0.75rem', borderRadius: 6 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ background: loading ? '#9ca3af' : '#0066CC', color: '#fff', padding: '0.75rem', borderRadius: 6, border: 'none', fontSize: '1rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Starting pipeline…' : 'Start Pipeline'}
        </button>
      </form>
    </main>
  )
}
