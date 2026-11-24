'use client'
import Link from 'next/link'
import { useCart, useCartDetails } from '@/components/useCart'
import { formatTRY } from '@/lib/money'
import { calcShipping, FREE_SHIPPING_THRESHOLD } from '@/utils/coupon'

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

function pickImageForVariant(images: any[], options?: Record<string, any> | null) {
  const validImgs = (Array.isArray(images) ? images : []).filter(
    (img) => typeof img === 'object' && Boolean(img?.url || img?.alt),
  )
  if (!validImgs.length) return null

  const colorVal = options?.renk || options?.color || options?.Renk
  if (colorVal && typeof colorVal === 'string') {
    const target = norm(colorVal.split(',')[0])
    const matched = validImgs.find((img) => {
      const cleanAlt = String(img.alt || '').split(SEP)[0]
      return (
        norm(cleanAlt).includes(target) ||
        norm(String(img.filename || '')).includes(target)
      )
    })
    if (matched) return matched
  }
  return validImgs[0]
}

export default function CartPage() {
  const { items, loading, subtotal } = useCartDetails()
  const { qty, change } = useCart()

  if (loading && items.length === 0) return <p className="muted">Yükleniyor…</p>
  if (items.length === 0)
    return (
      <div className="panel stack">
        <h1>Sepetiniz boş</h1>
        <Link className="btn" href="/">
          Alışverişe başla
        </Link>
      </div>
    )
  const shipping = calcShipping(subtotal)

  return (
    <div className="two" style={{ gridTemplateColumns: '2fr 1fr' }}>
      <div>
        <h1>Sepetim</h1>
        {items.map((i) => {
          const v = i.variant
          const p = v.product
          const vid = String(v.id)
          const img = pickImageForVariant(p.images, v.options)
          const rawAlt = String(img?.alt || '')
          const [cleanAlt, embeddedB64] = rawAlt.includes(SEP)
            ? rawAlt.split(SEP)
            : [rawAlt, '']
          const imgSrc = embeddedB64 || img?.url

          const optionText = v.options
            ? Object.entries(v.options)
                .map(([k, val]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${String(val).split(',')[0].trim()}`)
                .join(' / ')
            : v.sku

          return (
            <div key={i.id} className="line">
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={cleanAlt || p.name}
                  style={{ objectFit: 'contain', background: '#fff', padding: 4, border: '1px solid #e5e7eb' }}
                />
              ) : (
                <div className="ph" />
              )}
              <div style={{ flex: 1 }}>
                <Link href={`/products/${p.slug}`} prefetch={false} style={{ fontWeight: 600 }}>
                  {p.name}
                </Link>
                <div className="muted" style={{ marginTop: 4 }}>
                  {optionText}
                </div>
                <div className="price" style={{ marginTop: 4 }}>
                  {formatTRY(v.price)}
                </div>
              </div>
              <input
                type="number"
                min={1}
                max={v.stock}
                value={i.quantity}
                style={{ width: 70 }}
                onChange={(e) => {
                  const next = Math.max(1, Math.min(v.stock, Number(e.target.value) || 1))
                  const delta = next - i.quantity
                  if (delta !== 0) {
                    change(vid, delta).catch((err: any) => alert(err.message || 'Güncellenemedi'))
                  }
                }}
              />
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  const current = qty[vid] ?? i.quantity
                  if (current > 0) {
                    change(vid, -current).catch((err: any) => alert(err.message || 'Silinemedi'))
                  }
                }}
              >
                Sil
              </button>
            </div>
          )
        })}
      </div>
      <div className="panel stack" style={{ alignSelf: 'start' }}>
        <h3 style={{ margin: 0 }}>Özet</h3>
        <div className="row between">
          <span>Ara toplam</span>
          <span>{formatTRY(subtotal)}</span>
        </div>
        <div className="row between">
          <span>Kargo</span>
          <span>{shipping === 0 ? 'Ücretsiz' : formatTRY(shipping)}</span>
        </div>
        {shipping > 0 && (
          <div className="muted">
            {formatTRY(FREE_SHIPPING_THRESHOLD)} üzeri kargo ücretsiz
          </div>
        )}
        <div className="row between">
          <strong>Toplam</strong>
          <strong>{formatTRY(subtotal + shipping)}</strong>
        </div>
        <Link className="btn" href="/checkout" style={{ textAlign: 'center' }}>
          Ödemeye Geç
        </Link>
        <div className="muted">Kupon indirimi bir sonraki adımda uygulanır.</div>
      </div>
    </div>
  )
}