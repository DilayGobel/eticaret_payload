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
  mavi: '#3b82f6', yesil: '#22c55e', yesilkrem: '#86efac', sari: '#eab308',
  mor: '#a855f7', gri: '#94a3b8', turuncu: '#f97316', krem: '#fef3c7',
}

const norm = (s: string) =>
  s.toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').trim()

const colorOf = (v: CardVariant) => String(v.options?.renk ?? v.options?.color ?? '').trim()

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
  const groups = useMemo(() => {
    const map = new Map<string, CardVariant[]>()
    for (const v of variants) {
      const k = colorOf(v)
      map.set(k, [...(map.get(k) ?? []), v])
    }
    return [...map.entries()].map(([color, list]) => ({ color, list, rep: pickRep(list) }))
  }, [variants])

  const colorToImgIdx = useMemo(() => {
    const res: Record<string, number> = {}
    const used = new Set<number>()
    const sorted = [...groups]
      .filter((g) => g.color)
      .sort((a, b) => norm(b.color).length - norm(a.color).length)

    for (const g of sorted) {
      const t = norm(g.color)
      const idx = images.findIndex((img, i) => {
        if (used.has(i)) return false
        const alt = String(img.alt || '')
        const suffix = alt.includes(' - ') ? norm(alt.split(' - ').pop() || '') : ''
        return suffix === t || norm(alt).includes(t) || norm(img.filename || '').includes(t)
      })
      if (idx !== -1) {
        res[g.color] = idx
        used.add(idx)
      }
    }

    groups.forEach((g, gi) => {
      if (res[g.color] === undefined) {
        res[g.color] = images[gi] && !used.has(gi) ? gi : 0
      }
    })
    return res
  }, [groups, images])

  const initialColor = useMemo(() => {
    if (!variants.length) return ''
    return colorOf(pickRep(variants))
  }, [variants])

  const [selColor, setSelColor] = useState(initialColor)
  const [imgIdx, setImgIdx] = useState(() => colorToImgIdx[initialColor] ?? 0)

  if (!groups.length) {
    return (
      <Link href={`/products/${slug}`} prefetch={false} className="card">
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

  const pickColor = (color: string, gi: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSelColor(color)
    setImgIdx(colorToImgIdx[color] ?? (images[gi] ? gi : 0))
  }

  const hasColors = groups.length > 1 || groups[0].color !== ''
  const img = images[imgIdx] ?? images[0]

  return (
    <Link href={`/products/${slug}`} prefetch={false} className="card">
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