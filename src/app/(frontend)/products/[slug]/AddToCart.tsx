'use client'

import { useState, useMemo, useEffect } from 'react'
import { formatTRY } from '@/lib/money'
import { useCart } from '@/components/useCart'

type V = {
  id: string
  sku: string
  price: number
  stock: number
  options?: Record<string, any> | null
}

type Img = {
  id: string
  url: string
  alt?: string
  filename?: string
}

const KEY_LABELS: Record<string, string> = {
  renk: 'Renk',
  switch: 'Switch',
  baglanti: 'Bağlantı',
  beden: 'Beden',
  boyut: 'Boyut',
}

function parseValues(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((x) => String(x).split(',')).map((x) => x.trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  }
  return []
}

// Türkçe karakter duyarsız küçük harfe çevirme (görsel eşleştirmesi için)
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

export function AddToCart({
  variants,
  images = [],
  productName,
  sellerName,
  description,
}: {
  variants: V[]
  images?: Img[]
  productName?: string
  sellerName?: string | null
  description?: string | null
}) {
  const { qty, loading, change } = useCart()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [activeImgIdx, setActiveImgIdx] = useState(0)

  const axes = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const v of variants) {
      if (!v.options) continue
      for (const [k, rawVal] of Object.entries(v.options)) {
        const vals = parseValues(rawVal)
        if (!vals.length) continue
        if (!map[k]) map[k] = []
        for (const val of vals) {
          if (!map[k].includes(val)) map[k].push(val)
        }
      }
    }
    return map
  }, [variants])

  const axisKeys = Object.keys(axes)
  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0]

  const [selectedOpts, setSelectedOpts] = useState<Record<string, string>>({})

  useEffect(() => {
    setSelectedOpts((prev) => {
      const next = { ...prev }
      for (const k of Object.keys(axes)) {
        if (!next[k] || !axes[k].includes(next[k])) {
          next[k] = axes[k][0]
        }
      }
      return next
    })
  }, [axes])

  // Renk seçildiğinde ilgili görseli bul ve değiştir
  const switchImageForColor = (colorValue: string) => {
    if (!images.length) return
    const target = norm(colorValue)

    // 1. Görselin alt metninde veya dosya adında renk adı geçiyor mu? (Örn: "pembe-klavye.png" veya alt="Pembe")
    const matchByTextIdx = images.findIndex(
      (img) =>
        (img.alt && norm(img.alt).includes(target)) ||
        (img.filename && norm(img.filename).includes(target)) ||
        (img.url && norm(img.url).includes(target))
    )
    if (matchByTextIdx !== -1) {
      setActiveImgIdx(matchByTextIdx)
      return
    }

    // 2. Eşleşen isim yoksa, rengin sırasına göre görsel seç (1. renk -> 1. görsel, 2. renk -> 2. görsel)
    const colorAxisKey = Object.keys(axes).find((k) => norm(k) === 'renk' || norm(k) === 'color')
    if (colorAxisKey) {
      const colorIdx = axes[colorAxisKey].indexOf(colorValue)
      if (colorIdx !== -1 && images[colorIdx]) {
        setActiveImgIdx(colorIdx)
      }
    }
  }

  const variantMatchesOption = (v: V, key: string, val: string) => {
    if (!v.options) return false
    return parseValues(v.options[key]).includes(val)
  }

  const sel =
    axisKeys.length === 0
      ? firstInStock
      : variants.find(
          (v) =>
            v.options &&
            axisKeys.every((k) => variantMatchesOption(v, k, selectedOpts[k]))
        ) ?? firstInStock

  const handleSelectAxis = (key: string, value: string) => {
    setMsg(null)
    setSelectedOpts((prev) => ({ ...prev, [key]: value }))
    if (norm(key) === 'renk' || norm(key) === 'color') {
      switchImageForColor(value)
    }
  }

  const isOptionAvailable = (key: string, value: string) => {
    return variants.some(
      (v) =>
        v.stock > 0 &&
        variantMatchesOption(v, key, value) &&
        axisKeys.every((k) => k === key || !selectedOpts[k] || variantMatchesOption(v, k, selectedOpts[k]))
    )
  }

  const inCartQty = sel ? qty[String(sel.id)] || 0 : 0

  const act = async (delta: number) => {
    if (!sel || busy) return
    if (delta > 0 && inCartQty >= sel.stock) return
    if (delta < 0 && inCartQty <= 0) return
    setBusy(true)
    setMsg(null)
    try {
      await change(String(sel.id), delta)
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Hata oluştu' })
    } finally {
      setBusy(false)
    }
  }

  const activeImage = images[activeImgIdx] ?? images[0]

  return (
    <div className="two">
      {/* SOL TARAF: Görsel Galerisi (Renk seçimine ve tıklamaya duyarlı) */}
      <div className="stack" style={{ gap: 12 }}>
        {activeImage?.url ? (
          <img
            src={activeImage.url}
            alt={activeImage.alt || productName || ''}
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              objectFit: 'cover',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              transition: 'all 0.2s ease',
            }}
          />
        ) : (
          <div className="ph" style={{ borderRadius: 12, minHeight: 360 }} />
        )}

        {images.length > 1 && (
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {images.map((img, idx) => {
              const isCurrent = idx === activeImgIdx
              return (
                <img
                  key={img.id || idx}
                  src={img.url}
                  alt={img.alt || ''}
                  onClick={() => setActiveImgIdx(idx)}
                  style={{
                    width: 72,
                    height: 72,
                    objectFit: 'cover',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: isCurrent ? '2px solid #ea580c' : '1px solid #cbd5e1',
                    opacity: isCurrent ? 1 : 0.65,
                    transition: 'all 0.15s ease',
                  }}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* SAĞ TARAF: Ürün Bilgileri & Seçenekler */}
      <div className="stack" style={{ gap: 16 }}>
        {productName && <h1 style={{ margin: 0 }}>{productName}</h1>}
        {sellerName && <div className="muted">Satıcı: {sellerName}</div>}
        {description && <p style={{ margin: 0 }}>{description}</p>}

        {!variants.length ? (
          <p className="muted">Bu ürün için seçenek bulunamadı.</p>
        ) : (
          <>
            <div className="price" style={{ fontSize: 26, fontWeight: 'bold' }}>
              {sel ? formatTRY(sel.price) : '—'}
            </div>

            {axisKeys.map((key) => (
              <div key={key} className="stack" style={{ gap: 8 }}>
                <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>
                  {KEY_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1)}:{' '}
                  <strong style={{ color: '#0f172a' }}>{selectedOpts[key]}</strong>
                </span>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  {axes[key].map((val) => {
                    const isSelected = selectedOpts[key] === val
                    const available = isOptionAvailable(key, val)
                    return (
                      <button
                        key={val}
                        type="button"
                        className={`opt ${isSelected ? 'sel' : ''} ${!available ? 'off' : ''}`}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          border: isSelected ? '2px solid #ea580c' : '1px solid #cbd5e1',
                          background: isSelected ? '#fff7ed' : '#ffffff',
                          color: isSelected ? '#ea580c' : '#1e293b',
                          fontWeight: isSelected ? 600 : 400,
                          cursor: available ? 'pointer' : 'not-allowed',
                          opacity: available ? 1 : 0.5,
                        }}
                        onClick={() => handleSelectAxis(key, val)}
                      >
                        {val}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="muted" style={{ fontSize: 14 }}>
              {!sel
                ? 'Bu kombinasyon mevcut değil'
                : sel.stock > 0
                  ? sel.stock <= 5
                    ? `Son ${sel.stock} adet!`
                    : 'Stokta var'
                  : 'Tükendi'}
            </div>

            {!sel ? null : loading && inCartQty === 0 ? (
              <span className="muted" style={{ fontSize: 14 }}>
                Yükleniyor...
              </span>
            ) : inCartQty === 0 ? (
              <button
                type="button"
                className="btn"
                onClick={() => act(1)}
                disabled={busy || sel.stock <= 0}
                style={{
                  maxWidth: 200,
                  padding: '10px 20px',
                  cursor: sel.stock <= 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Sepete Ekle
              </button>
            ) : (
              <div className="row" style={{ alignItems: 'center', gap: 12 }}>
                <div
                  className="row"
                  style={{
                    alignItems: 'center',
                    gap: 10,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    padding: '6px 12px',
                    width: 'fit-content',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => act(-1)}
                    style={{
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#0f172a',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: 16,
                    }}
                  >
                    -
                  </button>

                  <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600, fontSize: 16 }}>
                    {inCartQty}
                  </span>

                  <button
                    type="button"
                    onClick={act.bind(null, 1)}
                    disabled={inCartQty >= sel.stock}
                    style={{
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                      border: '1px solid #cbd5e1',
                      background: inCartQty >= sel.stock ? '#e2e8f0' : '#f8fafc',
                      color: '#0f172a',
                      cursor: inCartQty >= sel.stock ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold',
                      fontSize: 16,
                    }}
                  >
                    +
                  </button>
                </div>

                <span className="muted" style={{ fontSize: 13, color: '#10b981' }}>
                  Sepette {inCartQty} adet
                </span>
              </div>
            )}

            {msg && <div className={msg.ok ? 'success' : 'error'}>{msg.text}</div>}
          </>
        )}
      </div>
    </div>
  )
}
