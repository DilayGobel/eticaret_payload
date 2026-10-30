// src/app/(frontend)/seller/products/[id]/page.tsx
'use client'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { api, uploadMedia } from '@/lib/api'
import { formatTRY } from '@/lib/money'

// "renk=Siyah, beden=42" -> { renk: 'Siyah', beden: '42' }
const parseOptions = (s: string) =>
  Object.fromEntries(s.split(',').map((p) => p.split('=').map((x) => x.trim())).filter(([k, v]) => k && v))

export default function EditProduct() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [variants, setVariants] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [nv, setNv] = useState({ sku: '', price: '', stock: '', options: '' })
  const [stockIn, setStockIn] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const [p, v, c] = await Promise.all([
      api(`/products/${id}?depth=1`),
      api(`/product-variants?where[product][equals]=${id}&limit=100&depth=0`),
      api('/categories?limit=200&depth=0'),
    ])
    setProduct(p); setVariants(v.docs); setCategories(c.docs)
  }, [id])
  useEffect(() => { load() }, [load])

  const run = async (fn: () => Promise<any>, ok = 'Kaydedildi.') => {
    setMsg('')
    try { await fn(); setMsg(ok); await load() } catch (e: any) { setMsg(e.message) }
  }

  if (!product) return <p className="muted">Yükleniyor…</p>

  const saveProduct = () => run(() => api(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: product.name,
      description: product.description,
      status: product.status,
      category: typeof product.category === 'object' ? product.category.id : product.category,
    }),
  }))

  const addImage = (file: File) => run(async () => {
    const media = await uploadMedia(file, product.name)
    const ids = (product.images || []).map((i: any) => (typeof i === 'object' ? i.id : i))
    await api(`/products/${id}`, { method: 'PATCH', body: JSON.stringify({ images: [...ids, media.id] }) })
  }, 'Görsel eklendi.')

  const removeImage = (imgId: string) => run(() => {
    const ids = (product.images || []).map((i: any) => (typeof i === 'object' ? i.id : i)).filter((x: string) => x !== imgId)
    return api(`/products/${id}`, { method: 'PATCH', body: JSON.stringify({ images: ids }) })
  })

  const addVariant = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      const price = Math.round(Number(nv.price.replace(',', '.')) * 100) // TL -> kuruş
      const res = await api('/product-variants', {
        method: 'POST',
        body: JSON.stringify({ product: id, sku: nv.sku, price, options: parseOptions(nv.options) }),
      })
      const initial = parseInt(nv.stock, 10)
      if (initial > 0) {
        await api('/inventory-logs', { method: 'POST', body: JSON.stringify({ variant: res.doc.id, change: initial, reason: 'restock', referenceId: 'ilk-stok' }) })
      }
      setNv({ sku: '', price: '', stock: '', options: '' })
    }, 'Varyant eklendi.')
  }

  const changePrice = (v: any) => {
    const input = prompt('Yeni fiyat (TL):', String(v.price / 100))
    if (!input) return
    run(() => api(`/product-variants/${v.id}`, { method: 'PATCH', body: JSON.stringify({ price: Math.round(Number(input.replace(',', '.')) * 100) }) }))
  }

  const addStock = (v: any) => {
    const change = parseInt(stockIn[v.id] || '', 10)
    if (!change) return
    run(async () => {
      await api('/inventory-logs', { method: 'POST', body: JSON.stringify({ variant: v.id, change, reason: change > 0 ? 'restock' : 'manual_correction' }) })
      setStockIn({ ...stockIn, [v.id]: '' })
    }, 'Stok güncellendi.')
  }

  return (
    <div className="stack">
      <h1>{product.name}</h1>
      {msg && <div className="muted">{msg}</div>}

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Ürün Bilgisi</h3>
        <input value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} />
        <textarea rows={4} value={product.description || ''} onChange={(e) => setProduct({ ...product, description: e.target.value })} />
        <select value={typeof product.category === 'object' ? product.category.id : product.category} onChange={(e) => setProduct({ ...product, category: e.target.value })}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={product.status} onChange={(e) => setProduct({ ...product, status: e.target.value })}>
          <option value="draft">Taslak</option>
          <option value="published">Yayında</option>
          <option value="archived">Arşivlendi</option>
        </select>
        {product.status === 'published' && variants.length === 0 && <div className="error">Yayında ama varyantı yok; vitrinde “Stokta yok” görünür.</div>}
        <button onClick={saveProduct}>Kaydet</button>
      </div>

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Görseller</h3>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {(product.images || []).filter((i: any) => typeof i === 'object').map((i: any) => (
            <div key={i.id} className="stack" style={{ gap: 4 }}>
              <img src={i.url} alt={i.alt} style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8 }} />
              <button className="secondary" onClick={() => removeImage(i.id)}>Kaldır</button>
            </div>
          ))}
        </div>
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && addImage(e.target.files[0])} />
      </div>

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Varyantlar ve Stok</h3>
        {variants.map((v) => (
          <div key={v.id} className="line">
            <div style={{ flex: 1 }}>
              <strong>{v.sku}</strong> <span className="muted">{v.options ? Object.entries(v.options).map(([k, x]) => `${k}: ${x}`).join(', ') : ''}</span>
              <div>{formatTRY(v.price)} · stok: <strong>{v.stock}</strong></div>
            </div>
            <button className="secondary" onClick={() => changePrice(v)}>Fiyat</button>
            <input type="number" placeholder="± adet" value={stockIn[v.id] || ''} onChange={(e) => setStockIn({ ...stockIn, [v.id]: e.target.value })} style={{ width: 90 }} />
            <button onClick={() => addStock(v)}>Stok Gir</button>
          </div>
        ))}
        <form className="stack" onSubmit={addVariant}>
          <h4 style={{ margin: '12px 0 0' }}>Yeni varyant</h4>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <input placeholder="SKU (benzersiz)" value={nv.sku} onChange={(e) => setNv({ ...nv, sku: e.target.value })} required />
            <input placeholder="Fiyat (TL)" value={nv.price} onChange={(e) => setNv({ ...nv, price: e.target.value })} required style={{ width: 120 }} />
            <input type="number" placeholder="İlk stok" value={nv.stock} onChange={(e) => setNv({ ...nv, stock: e.target.value })} style={{ width: 100 }} />
            <input placeholder="Seçenekler: renk=Siyah, beden=42" value={nv.options} onChange={(e) => setNv({ ...nv, options: e.target.value })} style={{ flex: 1, minWidth: 220 }} />
          </div>
          <button style={{ alignSelf: 'flex-start' }}>Varyant Ekle</button>
        </form>
      </div>
    </div>
  )
}