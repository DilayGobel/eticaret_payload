'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatTRY } from '@/lib/money'
import { HomeAddToCart } from '@/components/HomeAddToCart'
import { ProductCardImage } from '@/components/ProductCardImage'

export type CardVariant = {
  id: string
  price: number
  stock: number
  options?: Record<string, any> | null
}

export type CardImg = { id: string; url: string; alt?: string; filename?: string }

const COLOR_HEX: Record<string, string> = {
  siyah: '#1e293b', beyaz: '#f8fafc', pembe: '#f472b6', kirmizi: '#ef4444',
  mavi: '#3b82f6', yesil: '#22c55e', sari: '#eab308', mor: '#a855f7',
  gri: '#94a3b8', turuncu: '#f97316',
}

const norm = (s: string) =>
  s.toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').trim()

const colorOf = (v: CardVariant) => String(v.options?.renk ?? v.options?.color ?? '').trim()

// Stoktakiler öncelikli, sonra en ucuz
const pickRep = (list: CardVariant[]) =>
  [...list].sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.price - b.price)[0]

export function ProductCard({
  slug, name, images, variants,
}: {
  slug: string
  name: string
  images: CardImg[]
  variants: CardVariant[]
}) {
  // Renge göre grupla (renk yoksa tek grup: '')
  const groups = useMemo(() => {
    const map = new Map<string, CardVariant[]>()
    for (const v of variants) {
      const k = colorOf(v)
      map.set(k, [...(map.get(k) ?? []), v])
    }
    return [...map.entries()].map(([color, list]) => ({ color, list, rep: pickRep(list) }))
  }, [variants])

  const initialColor = useMemo(() => {
    if (!variants.length) return ''
    return colorOf(pickRep(variants))
  }, [variants])

  const [selColor, setSelColor] = useState(initialColor)
  const [imgIdx, setImgIdx] = useState(0)

  if (!groups.length) {
    return (
      <Link href={`/products/${slug}`} className="card">
        <ProductCardImage images={images} productName={name} />
        <div className="pad">
          <div style={{ fontWeight: 500, marginBottom: 4 }}>{name}</div>
          <div className="price">Stokta yok</div>
        </div>
      </Link>
    )
  }

  const group = groups.find((g) => g.color === selColor) ?? groups[0]
  const prices = group.list.map((v) => v.price)
  const minPrice = Math.min(...prices)
  const hasRange = Math.max(...prices) !== minPrice
  const rep = group.rep

  const imageIndexFor = (color: string, groupIdx: number) => {
    const t = norm(color)
    const byText = images.findIndex(
      (i) => norm(i.alt || '').includes(t) || norm(i.filename || '').includes(t),
    )
    if (byText !== -1) return byText
    return images[groupIdx] ? groupIdx : 0
  }

  const pickColor = (color: string, gi: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelColor(color)
    setImgIdx(imageIndexFor(color, gi))
  }

  const hasColors = groups.length > 1 || groups[0].color !== ''
  const img = images[imgIdx] ?? images[0]

  return (
    <Link href={`/products/${slug}`} className="card">
      {/* Görsel: renk varsa renk noktaları, yoksa eski görsel noktaları */}
      {hasColors && groups.length > 1 ? (
        <div style={{ background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
          {img ? (
            <img
              src={img.url}
              alt={img.alt || name}
              style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'contain', padding: 12, display: 'block' }}
            />
          ) : (
            <div className="ph" />
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 7, padding: '2px 0 10px' }}>
            {groups.map((g, gi) => {
              const selected = g.color === group.color
              const inStock = g.list.some((v) => v.stock > 0)
              return (
                <button
                  key={g.color}
                  type="button"
                  title={g.color}
                  onClick={pickColor(g.color, gi)}
                  style={{
                    width: 14, height: 14, borderRadius: '50%', padding: 0,
                    background: COLOR_HEX[norm(g.color)] ?? '#cbd5e1',
                    border: selected ? '2px solid #e8590c' : '1px solid #cbd5e1',
                    boxShadow: selected ? '0 0 0 2px rgba(232,89,12,0.2)' : 'none',
                    opacity: inStock ? 1 : 0.35,
                    cursor: 'pointer',
                  }}
                />
              )
            })}
          </div>
        </div>
      ) : (
        <ProductCardImage images={images} productName={name} />
      )}

      <div className="pad">
        <div style={{ fontWeight: 500, marginBottom: 4 }}>{name}</div>
        {hasColors && <div className="muted" style={{ fontSize: 12 }}>{group.color}</div>}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div className="price" style={{ margin: 0 }}>
            {hasRange && <span className="muted" style={{ fontSize: 12 }}>’den </span>}
            {formatTRY(minPrice)}
          </div>
          {group.list.length === 1 && rep.stock > 0 ? (
            <HomeAddToCart key={rep.id} variantId={rep.id} stock={rep.stock} />
          ) : group.list.length > 1 ? (
            <span className="muted" style={{ fontSize: 12 }}>Seçenekler →</span>
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>Tükendi</span>
          )}
        </div>
      </div>
    </Link>
  )
}