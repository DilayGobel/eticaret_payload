// src/app/(frontend)/seller/products/page.tsx
'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSeller } from '@/components/SellerGate'
import { api } from '@/lib/api'
import { slugify, withSuffix } from '@/lib/slug'

const STATUS: Record<string, string> = { draft: 'Taslak', published: 'Yayında', archived: 'Arşiv', rejected: 'Reddedildi' }

export default function SellerProducts() {
  const seller = useSeller()
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [form, setForm] = useState({ name: '', category: '', description: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    api(`/products?where[seller][equals]=${seller.id}&limit=200&sort=-createdAt&depth=0`).then((r) => setProducts(r.docs))
    api('/categories?where[isActive][equals]=true&limit=200&depth=0').then((r) => setCategories(r.docs))
  }, [seller.id])

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    try {
      const res = await api('/products', {
        method: 'POST',
        body: JSON.stringify({ ...form, slug: withSuffix(slugify(form.name)), status: 'draft' }),
      })
      router.push(`/seller/products/${res.doc.id}`) // varyant ve görseller için düzenleme sayfasına git
    } catch (err: any) { setError(err.message) }
  }

  return (
    <div className="two" style={{ gridTemplateColumns: '2fr 1fr' }}>
      <div>
        <h1>Ürünlerim</h1>
        {products.length === 0 && <p className="muted">Henüz ürün eklemedin.</p>}
        {products.map((p) => (
          <Link key={p.id} href={`/seller/products/${p.id}`} className="line">
            <div style={{ flex: 1 }}>{p.name}</div>
            <span className="tag">{STATUS[p.status]}</span>
          </Link>
        ))}
      </div>
      <form className="panel stack" onSubmit={create} style={{ alignSelf: 'start' }}>
        <h3 style={{ margin: 0 }}>Yeni Ürün</h3>
        <input placeholder="Ürün adı" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
          <option value="">Kategori seç</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <textarea rows={4} placeholder="Açıklama" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        {error && <div className="error">{error}</div>}
        <button>Oluştur ve Devam Et</button>
      </form>
    </div>
  )
}