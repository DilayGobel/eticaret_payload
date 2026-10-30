'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/Providers'
import { api } from '@/lib/api'

const STATUS: Record<string, string> = { open: 'Açık', in_progress: 'İşlemde', resolved: 'Çözüldü', closed: 'Kapatıldı' }

export default function SupportPage() {
  const { user, loading } = useAuth()
  const [tickets, setTickets] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [reply, setReply] = useState('')
  const [form, setForm] = useState({ subject: '', message: '', relatedOrder: '' })
  const [error, setError] = useState('')

  const loadTickets = useCallback(async () => {
    const [t, o] = await Promise.all([api('/tickets?sort=-createdAt&depth=0&limit=50'), api('/orders?depth=0&limit=50')])
    setTickets(t.docs); setOrders(o.docs)
  }, [])
  const loadMessages = async (id: string) => {
    setOpen(id)
    const res = await api(`/ticket-messages?where[ticket][equals]=${id}&sort=createdAt&depth=0&limit=200`)
    setMessages(res.docs)
  }
  useEffect(() => { if (user) loadTickets() }, [user, loadTickets])

  if (loading) return <p className="muted">Yükleniyor…</p>
  if (!user) return <div className="panel"><Link href="/login">Destek için giriş yap</Link></div>

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    try {
      const t = await api('/tickets', { method: 'POST', body: JSON.stringify({ subject: form.subject, relatedOrder: form.relatedOrder || undefined }) })
      await api('/ticket-messages', { method: 'POST', body: JSON.stringify({ ticket: t.doc.id, message: form.message }) })
      setForm({ subject: '', message: '', relatedOrder: '' })
      await loadTickets()
    } catch (err: any) { setError(err.message) }
  }
  const send = async () => {
    if (!open || !reply.trim()) return
    await api('/ticket-messages', { method: 'POST', body: JSON.stringify({ ticket: open, message: reply }) })
    setReply(''); await loadMessages(open)
  }

  return (
    <div className="two">
      <div className="stack">
        <h1>Destek Taleplerim</h1>
        {tickets.length === 0 && <p className="muted">Henüz talebin yok.</p>}
        {tickets.map((t) => (
          <div key={t.id} className="panel stack">
            <div className="row between" style={{ cursor: 'pointer' }} onClick={() => (open === t.id ? setOpen(null) : loadMessages(t.id))}>
              <span><strong>{t.ticketNumber}</strong> — {t.subject}</span>
              <span className="tag">{STATUS[t.status]}</span>
            </div>
            {open === t.id && (
              <>
                {messages.map((m) => (
                  <div key={m.id} className="muted" style={{ background: String(m.sender) === String(user.id) ? '#fff4ec' : '#f1f5f9', padding: 8, borderRadius: 8 }}>{m.message}</div>
                ))}
                {t.status !== 'closed' && (
                  <div className="row">
                    <input style={{ flex: 1 }} placeholder="Yanıt yaz…" value={reply} onChange={(e) => setReply(e.target.value)} />
                    <button onClick={send}>Gönder</button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <form className="panel stack" onSubmit={create} style={{ alignSelf: 'start' }}>
        <h3 style={{ margin: 0 }}>Yeni Talep</h3>
        <input placeholder="Konu" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
        <select value={form.relatedOrder} onChange={(e) => setForm({ ...form, relatedOrder: e.target.value })}>
          <option value="">İlgili sipariş (opsiyonel)</option>
          {orders.map((o) => <option key={o.id} value={o.id}>{o.orderNumber}</option>)}
        </select>
        <textarea rows={5} placeholder="Mesajın" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
        {error && <div className="error">{error}</div>}
        <button>Talep Oluştur</button>
      </form>
    </div>
  )
}