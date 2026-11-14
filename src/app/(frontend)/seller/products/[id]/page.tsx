// src/app/(frontend)/seller/products/[id]/page.tsx
'use client'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { api, uploadMedia } from '@/lib/api'
import { formatTRY } from '@/lib/money'

const code = (s: string) =>
  s
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9]/g, '')

export default function EditProduct() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [variants, setVariants] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  // Çoklu renk ve özellik destekli varyant formu
  const [nv, setNv] = useState({
    skuPrefix: '',
    price: '',
    stock: '',
    colors: '', // Örn: "Siyah, Beyaz, Kırmızı"
    attrName: 'beden', // Örn: "beden", "switch", "baglanti"
    attrValues: '', // Örn: "S, M, L" veya "Red, Blue"
  })
  const [stockIn, setStockIn] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const [p, v, c] = await Promise.all([
      api(`/products/${id}?depth=1`),
      api(`/product-variants?where[product][equals]=${id}&limit=100&depth=0`),
      api('/categories?limit=200&depth=0'),
    ])
    setProduct(p)
    setVariants(v.docs)
    setCategories(c.docs)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const run = async (fn: () => Promise<any>, ok = 'Kaydedildi.') => {
    setMsg('')
    try {
      await fn()
      setMsg(ok)
      await load()
    } catch (e: any) {
      setMsg(e.message)
    }
  }

  if (!product) return <p className="muted">Yükleniyor…</p>

  const saveProduct = () =>
    run(() =>
      api(`/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: product.name,
          description: product.description,
          status: product.status,
          category: typeof product.category === 'object' ? product.category.id : product.category,
        }),
      }),
    )

  const addImage = (file: File) =>
    run(async () => {
      const media = await uploadMedia(file, product.name)
      const ids = (product.images || []).map((i: any) => (typeof i === 'object' ? i.id : i))
      await api(`/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ images: [...ids, media.id] }),
      })
    }, 'Görsel eklendi.')

  const removeImage = (imgId: string) =>
    run(() => {
      const ids = (product.images || [])
        .map((i: any) => (typeof i === 'object' ? i.id : i))
        .filter((x: string) => x !== imgId)
      return api(`/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ images: ids }),
      })
    })

  // Birden fazla rengi ve özelliği tek seferde kombinasyonlayıp varyant olarak ekler
  const addVariant = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      const price = Math.round(Number(nv.price.replace(',', '.')) * 100) // TL -> kuruş
      const initial = parseInt(nv.stock, 10)

      const colorList = nv.colors
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const extraList = nv.attrValues
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const extraKey = nv.attrName.trim().toLowerCase() || 'secenek'

      // Kombinasyonları oluştur
      let combos: Record<string, string>[] = [{}]
      if (colorList.length > 0) {
        combos = combos.flatMap((c) => colorList.map((col) => ({ ...c, renk: col })))
      }
      if (extraList.length > 0) {
        combos = combos.flatMap((c) => extraList.map((val) => ({ ...c, [extraKey]: val })))
      }

      const prefix = code(nv.skuPrefix || product.name.slice(0, 4) || 'URN')

      for (const options of combos) {
        const optValues = Object.values(options)
        const suffix = optValues.length > 0 ? '-' + optValues.map(code).join('-') : ''
        const sku = combos.length === 1 && nv.skuPrefix ? nv.skuPrefix.trim() : `${prefix}${suffix}`

        const res = await api('/product-variants', {
          method: 'POST',
          body: JSON.stringify({
            product: id,
            sku,
            price,
            options,
          }),
        })

        if (initial > 0) {
          await api('/inventory-logs', {
            method: 'POST',
            body: JSON.stringify({
              variant: res.doc.id,
              change: initial,
              reason: 'restock',
              referenceId: 'ilk-stok',
            }),
          })
        }
      }

      setNv({ skuPrefix: '', price: '', stock: '', colors: '', attrName: 'beden', attrValues: '' })
    }, 'Varyant(lar) başarıyla eklendi.')
  }

  const changePrice = (v: any) => {
    const input = prompt('Yeni fiyat (TL):', String(v.price / 100))
    if (!input) return
    run(() =>
      api(`/product-variants/${v.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ price: Math.round(Number(input.replace(',', '.')) * 100) }),
      }),
    )
  }

  const addStock = (v: any) => {
    const change = parseInt(stockIn[v.id] || '', 10)
    if (!change) return
    run(async () => {
      await api('/inventory-logs', {
        method: 'POST',
        body: JSON.stringify({
          variant: v.id,
          change,
          reason: change > 0 ? 'restock' : 'manual_correction',
        }),
      })
      setStockIn({ ...stockIn, [v.id]: '' })
    }, 'Stok güncellendi.')
  }

  const images = (product.images || []).filter((i: any) => typeof i === 'object')

  return (
    <div className="stack">
      <h1>{product.name}</h1>
      {msg && <div className="muted" style={{ color: '#10b981', fontWeight: 600 }}>{msg}</div>}

      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Ürün Bilgisi</h3>
        <input
          value={product.name}
          onChange={(e) => setProduct({ ...product, name: e.target.value })}
        />
        <textarea
          rows={4}
          value={product.description || ''}
          onChange={(e) => setProduct({ ...product, description: e.target.value })}
        />
        <select
          value={typeof product.category === 'object' ? product.category.id : product.category}
          onChange={(e) => setProduct({ ...product, category: e.target.value })}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={product.status}
          onChange={(e) => setProduct({ ...product, status: e.target.value })}
        >
          <option value="draft">Taslak</option>
          <option value="published">Yayında</option>
          <option value="archived">Arşivlendi</option>
        </select>
        {product.status === 'published' && variants.length === 0 && (
          <div className="error">Yayında ama varyantı yok; vitrinde “Stokta yok” görünür.</div>
        )}
        <button type="button" onClick={saveProduct}>
          Ürünü Kaydet
        </button>
      </div>

      {/* Görseller */}
      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Görseller</h3>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
          {images.map((img: any) => (
            <div key={img.id} style={{ position: 'relative' }}>
              <img
                src={img.url}
                alt={img.alt || ''}
                style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8 }}
              />
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  padding: '2px 6px',
                  fontSize: 12,
                }}
              >
                Sil
              </button>
            </div>
          ))}
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && addImage(e.target.files[0])}
        />
      </div>

      {/* Varyantlar */}
      <div className="panel stack">
        <h3 style={{ margin: 0 }}>Varyantlar & Renk Seçenekleri</h3>

        {variants.length === 0 && <p className="muted">Henüz varyant eklenmedi.</p>}

        {variants.map((v) => (
          <div key={v.id} className="line" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <strong>{v.sku}</strong>
              {v.options && Object.keys(v.options).length > 0 && (
                <span className="muted" style={{ marginLeft: 8 }}>
                  ({Object.entries(v.options).map(([k, val]) => `${k}: ${val}`).join(', ')})
                </span>
              )}
            </div>
            <div>{formatTRY(v.price)}</div>
            <button type="button" className="opt" onClick={() => changePrice(v)}>
              Fiyat Değiştir
            </button>
            <div className="muted">Stok: {v.stock}</div>
            <div className="row" style={{ gap: 6 }}>
              <input
                style={{ width: 80 }}
                placeholder="+/- stok"
                value={stockIn[v.id] || ''}
                onChange={(e) => setStockIn({ ...stockIn, [v.id]: e.target.value })}
              />
              <button type="button" className="opt" onClick={() => addStock(v)}>
                Uygula
              </button>
            </div>
          </div>
        ))}

        <hr style={{ borderColor: 'rgba(255,255,255,0.1)', width: '100%' }} />

        <form className="stack" onSubmit={addVariant} style={{ gap: 10 }}>
          <h4 style={{ margin: 0 }}>Yeni Renk / Varyant Ekle (Çoklu Ekleyebilirsin)</h4>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <input
              placeholder="SKU Ön Eki (örn: KLV)"
              value={nv.skuPrefix}
              onChange={(e) => setNv({ ...nv, skuPrefix: e.target.value })}
              required
            />
            <input
              placeholder="Fiyat (TL, örn: 1299)"
              value={nv.price}
              onChange={(e) => setNv({ ...nv, price: e.target.value })}
              required
            />
            <input
              placeholder="Başlangıç Stoğu (örn: 10)"
              value={nv.stock}
              onChange={(e) => setNv({ ...nv, stock: e.target.value })}
              required
            />
          </div>

          <div className="stack" style={{ gap: 6 }}>
            <label className="muted" style={{ fontSize: 13 }}>
              Renkler (Birden fazla rengi virgülle ayırarak yaz: örn. <b>Siyah, Beyaz, Kırmızı, Mavi</b>)
            </label>
            <input
              placeholder="Siyah, Beyaz, Kırmızı"
              value={nv.colors}
              onChange={(e) => setNv({ ...nv, colors: e.target.value })}
            />
          </div>

          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <input
              style={{ flex: 1 }}
              placeholder="Ek Özellik Adı (örn: switch, beden, baglanti)"
              value={nv.attrName}
              onChange={(e) => setNv({ ...nv, attrName: e.target.value })}
            />
            <input
              style={{ flex: 2 }}
              placeholder="Ek Özellik Değerleri (opsiyonel, virgülle: Red, Blue veya S, M, L)"
              value={nv.attrValues}
              onChange={(e) => setNv({ ...nv, attrValues: e.target.value })}
            />
          </div>

          <button type="submit" className="btn">
            Varyant(ları) Oluştur
          </button>
        </form>
      </div>
    </div>
  )
}