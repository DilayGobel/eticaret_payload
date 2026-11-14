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

const KEY_LABELS: Record<string, string> = {
  renk: 'Renk',
  switch: 'Switch',
  baglanti: 'Bağlantı',
  beden: 'Beden',
  boyut: 'Boyut',
}

// "Siyah, Beyaz, Pembe" metnini ['Siyah', 'Beyaz', 'Pembe'] olarak ayrı seçeneklere böler
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

export function AddToCart({ variants }: { variants: V[] }) {
  const { qty, loading, change } = useCart()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

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

  // Sayfa yüklendiğinde her özelliğin ilk seçeneğini (Örn: Siyah, Red, Kablolu) varsayılan seçili yap
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

  if (!variants.length) {
    return <p className="muted">Bu ürün için seçenek bulunamadı.</p>
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

  return (
    <div className="stack" style={{ gap: 16 }}>
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
    </div>
  )
}
