// src/components/SellerGate.tsx
'use client'
import Link from 'next/link'
import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './Providers'
import { api } from '@/lib/api'
import { slugify } from '@/lib/slug'

const SellerCtx = createContext<any>(null)
export const useSeller = () => useContext(SellerCtx) as any

const STATUS_TEXT: Record<string, string> = {
  pending: 'Başvurun inceleniyor. Onaylandığında bu sayfadan mağazanı yönetebileceksin.',
  rejected: 'Başvurun reddedildi. Detay için destek talebi açabilirsin.',
  suspended: 'Mağazan askıya alındı. Detay için destek talebi açabilirsin.',
}

// /seller altındaki tüm sayfaları sarar: giriş + mağaza + onay kontrolü yapar.
export function SellerGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const [seller, setSeller] = useState<any | null | undefined>(undefined) // undefined = yükleniyor
  const [form, setForm] = useState({ storeName: '', taxId: '', payoutIban: '' })
  const [error, setError] = useState('')

  const loadSeller = async () => {
    const res = await api(`/sellers?where[owner][equals]=${user.id}&limit=1&depth=0`)
    setSeller(res.docs[0] ?? null)
  }
  useEffect(() => { if (user) loadSeller() }, [user])

  if (loading) return <p className="muted">Yükleniyor…</p>
  if (!user) return <div className="panel stack"><p>Satıcı paneli için giriş yapmalısın.</p><Link className="btn" href="/login">Giriş Yap</Link></div>
  if (seller === undefined) return <p className="muted">Yükleniyor…</p>

  if (seller === null) {
    const apply = async (e: React.FormEvent) => {
      e.preventDefault(); setError('')
      try {
        await api('/sellers', { method: 'POST', body: JSON.stringify({ ...form, slug: slugify(form.storeName) }) })
        await loadSeller()
      } catch (err: any) { setError(err.message) }
    }
    return (
      <form className="form stack panel" onSubmit={apply}>
        <h1>Satıcı Ol</h1>
        <input placeholder="Mağaza adı" value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} required />
        <input placeholder="VKN / TCKN" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} required />
        <input placeholder="IBAN (TR…)" value={form.payoutIban} onChange={(e) => setForm({ ...form, payoutIban: e.target.value })} required />
        {error && <div className="error">{error}</div>}
        <button>Başvur</button>
      </form>
    )
  }

  if (seller.status !== 'approved') {
    return <div className="panel stack"><h1>{seller.storeName}</h1><p>{STATUS_TEXT[seller.status]}</p></div>
  }

  return (
    <SellerCtx.Provider value={seller}>
      <div className="chips">
        <Link className="chip" href="/seller">Panel</Link>
        <Link className="chip" href="/seller/products">Ürünlerim</Link>
        <Link className="chip" href="/seller/orders">Siparişler</Link>
        <Link className="chip" href="/seller/earnings">Hakediş</Link>
      </div>
      {children}
    </SellerCtx.Provider>
  )
}