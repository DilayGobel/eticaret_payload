// src/app/(frontend)/seller/products/[id]/page.tsx
'use client'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { api, uploadMedia } from '@/lib/api'
import { formatTRY } from '@/lib/money'

const SEP = '|||'

const norm = (s: string) =>
  s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim()

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

const getCleanAlt = (alt?: string) => String(alt || '').split(SEP)[0]

const buildAltWithColor = (existingAlt: string | undefined, productName: string, color: string) => {
  const raw = String(existingAlt || '')
  const b64Part = raw.includes(SEP) ? SEP + raw.split(SEP).slice(1).join(SEP) : ''
  const label = color ? `${productName} - ${color}` : productName
  return `${label}${b64Part}`
}

export default function EditProduct() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [variants, setVariants] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [uploadColor, setUploadColor] = useState('')

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

  const variantColors = Array.from(
    new Set(
      variants.flatMap((v) =>
        String(v.options?.renk ?? v.options?.color ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ),
  )

  const getAssignedColor = (img: any) => {
    const clean = getCleanAlt(img.alt)
    const suffix = clean.startsWith(`${product.name} - `)
      ? clean.slice(`${product.name} - `.length).trim()
      : clean
    return (
      variantColors.find((c) => norm(suffix) === norm(c)) ??
      variantColors.find((c) => norm(clean).includes(norm(c))) ??
      ''
    )
  }

  const saveProduct = () =>
    run(() =>
      api(`/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: product.name,
          description: product.description,
          category: typeof product.category === 'object' ? product.category.id : product.category,
          ...(['draft', 'archived'].includes(product.status) ? { status: product.status } : {}),
        }),
      }),
    )

  const addImage = (file: File) =>
    run(async () => {
      const altText = uploadColor ? `${product.name} - ${uploadColor}` : product.name
      const media = await uploadMedia(file, altText)
      const ids = (product.images || []).map((i: any) => (typeof i === 'object' ? i.id : i))
      await api(`/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ images: [...ids, media.id] }),
      })
    }, 'Görsel eklendi.')

  const assignImageColor = (img: any, color: string) =>
    run(async () => {
      const nextAlt = buildAltWithColor(img.alt, product.name, color)
      await api(`/media/${img.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ alt: nextAlt }),
      })
    }, 'Görsel rengi güncellendi.')

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
        {['draft', 'archived'].includes(product.status) ? (
          <select
            value={product.status}
            onChange={(e) => setProduct({ ...product, status: e.target.value })}
          >
            <option value="draft">Taslak</option>
            <option value="archived">Arşivlendi</option>
          </select>
        ) : (
          <div className="muted">
            Durum: {product.status === 'published' ? 'Yayında' : 'Reddedildi'} (yönetici tarafından belirlenir)
          </div>
        )}
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
          {images.map((img: any) => {
            const rawAlt = String(img.alt || '')
            const embeddedB64 = rawAlt.includes(SEP) ? rawAlt.split(SEP)[1] : ''
            const src = embeddedB64 || img.url

            return (
              <div key={img.id} className="stack" style={{ gap: 6, width: 110 }}>
                <div style={{ position: 'relative' }}>
                  <img
                    src={src}
                    alt={getCleanAlt(img.alt)}
                    style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 8, background: '#fff' }}
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

                {variantColors.length > 0 && (
                  <select
                    value={getAssignedColor(img)}
                    onChange={(e) => assignImageColor(img, e.target.value)}
                    style={{ fontSize: 12, padding: '4px 6px' }}
                  >
                    <option value="">Genel Görsel</option>
                    {variantColors.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
        </div>

        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {variantColors.length > 0 && (
            <select
              value={uploadColor}
              onChange={(e) => setUploadColor(e.target.value)}
              style={{ maxWidth: 180 }}
            >
              <option value="">Renk Seç (Opsiyonel)</option>
              {variantColors.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && addImage(e.target.files[0])}
          />
        </div>
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