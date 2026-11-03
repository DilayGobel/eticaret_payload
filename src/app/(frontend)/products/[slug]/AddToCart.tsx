'use client'

import { useState } from 'react'
import { formatTRY } from '@/lib/money'
import { useCart } from '@/components/useCart'

type V = { id: string; sku: string; price: number; stock: number; options?: Record<string, string> | null }

export function AddToCart({ variants }: { variants: V[] }) {
  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0]
  const [sel, setSel] = useState<V | undefined>(firstInStock)
  const { qty, loading, change } = useCart()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  if (!sel) return <p className="muted">Bu ürün için seçenek bulunamadı.</p>

  const inCartQty = qty[String(sel.id)] || 0

  const label = (v: V) => (v.options && Object.values(v.options).join(' / ')) || v.sku

  const act = async (delta: number) => {
    if (busy) return
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
        {formatTRY(sel.price)}
      </div>

      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {variants.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`opt ${sel.id === v.id ? 'sel' : ''} ${v.stock <= 0 ? 'off' : ''}`}
            style={{ color: 'inherit', fontWeight: 400 }}
            disabled={v.stock <= 0}
            onClick={() => {
              setSel(v)
              setMsg(null)
            }}
          >
            {label(v)}
          </button>
        ))}
      </div>

      <div className="muted" style={{ fontSize: 14 }}>
        {sel.stock > 0 ? (sel.stock <= 5 ? `Son ${sel.stock} adet!` : 'Stokta var') : 'Tükendi'}
      </div>

      {loading && inCartQty === 0 ? (
        <span className="muted" style={{ fontSize: 14 }}>Yükleniyor...</span>
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
              onClick={() => act(1)}
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