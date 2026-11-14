'use client'

import { useState } from 'react'

type CardImg = {
  id: string
  url: string
  alt?: string
  filename?: string
}

const COLOR_MAP: Record<string, string> = {
  siyah: '#1e293b',
  beyaz: '#f8fafc',
  pembe: '#f472b6',
  kirmizi: '#ef4444',
  mavi: '#3b82f6',
  yesil: '#22c55e',
  sari: '#eab308',
  mor: '#a855f7',
  gri: '#94a3b8',
  turuncu: '#f97316',
}

function detectColorHex(img: CardImg): string | null {
  const text = `${img.alt || ''} ${img.filename || ''}`
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')

  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    if (text.includes(key)) return hex
  }
  return null
}

export function ProductCardImage({
  images,
  productName,
}: {
  images: CardImg[]
  productName: string
}) {
  const [idx, setIdx] = useState(0)

  if (!images || images.length === 0) {
    return <div className="ph" />
  }

  const current = images[idx] ?? images[0]

  const selectDot = (newIdx: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIdx(newIdx)
  }

  return (
    <div style={{ position: 'relative', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
      <img
        src={current.url}
        alt={current.alt || productName}
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          objectFit: 'contain',
          background: '#fff',
          padding: 12,
          display: 'block',
        }}
      />

      {images.length > 1 && (
        <div
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 7,
            paddingBottom: 10,
            paddingTop: 2,
            background: '#fff',
          }}
        >
          {images.map((img, i) => {
            const isSelected = i === idx
            const colorHex = detectColorHex(img)

            return (
              <button
                key={img.id || i}
                type="button"
                title={img.alt || `Görsel ${i + 1}`}
                onClick={selectDot(i)}
                style={{
                  width: colorHex ? 14 : 9,
                  height: colorHex ? 14 : 9,
                  borderRadius: '50%',
                  padding: 0,
                  border: isSelected
                    ? '2px solid #e8590c'
                    : '1px solid #cbd5e1',
                  background: colorHex
                    ? colorHex
                    : isSelected
                      ? '#e8590c'
                      : '#cbd5e1',
                  boxShadow: isSelected ? '0 0 0 2px rgba(232, 89, 12, 0.2)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
