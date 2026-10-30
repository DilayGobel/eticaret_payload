'use client'

import { useState } from 'react'
import { addToCart } from '@/lib/api'
import { formatTRY } from '@/lib/money'
import { useCart } from '@/components/useCart'

type V = { id: string; sku: string; price: number; stock: number; options?: Record<string, string> | null }

export function AddToCart({ variants }: { variants: V[] }) {
  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0]
  const [sel, setSel] = useState<V | undefined>(firstInStock)
  const { items, loading, reload } = useCart()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  if (!sel) return <p className="muted">Bu ürün için seçenek bulunamadı.</p>

  // Sepetteki ilgili varyantı bul
  const currentVariantId = String(sel.id)
  const inCartItem = items.find((item: any) => {
    const raw = item.variant
    const vId = typeof raw === 'object' && raw !== null ? (raw.id || raw._id) : raw
    return String(vId) === currentVariantId
  })
  console.log('--- SEPET EŞLEŞTİRME TESTİ ---')
  console.log('Seçili Varyant ID (sel.id):', sel.id)
  console.log('useCart items dizisi:', items)
  const inCartQty = inCartItem?.quantity || 0

  const label = (v: V) => (v.options && Object.values(v.options).join(' / ')) || v.sku

  const handleIncrease = async () => {
    if (busy || loading || inCartQty >= sel.stock) return
    setBusy(true)
    setMsg(null)
    try {
      await addToCart(sel.id, 1)
      window.dispatchEvent(new Event('cart-changed'))
      await reload()
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Hata oluştu' })
    } finally {
      setBusy(false)
    }
  }

  const handleDecrease = async () => {
    if (busy || loading || inCartQty <= 0) return
    setBusy(true)
    setMsg(null)
    try {
      await addToCart(sel.id, -1)
      window.dispatchEvent(new Event('cart-changed'))
      await reload()
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

      {/* Sepet ilk yüklenirken yanlış buton gösterme */}
      {loading && inCartQty === 0 ? (
        <span className="muted" style={{ fontSize: 14 }}>Yükleniyor...</span>
      ) : inCartQty === 0 ? (
        <button
          type="button"
          className="btn"
          onClick={handleIncrease}
          disabled={busy || loading || sel.stock <= 0}
          style={{
            maxWidth: 200,
            padding: '10px 20px',
            cursor: sel.stock <= 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Ekleniyor...' : 'Sepete Ekle'}
        </button>
      ) : (
        <div className="row" style={{ alignItems: 'center', gap: 12 }}>
          <div
            className="row"
            style={{
              alignItems: 'center',
              gap: 10,
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '6px 12px',
              width: 'fit-content',
            }}
          >
            <button
              type="button"
              onClick={handleDecrease}
              disabled={busy || loading}
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
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
              onClick={handleIncrease}
              disabled={busy || loading || inCartQty >= sel.stock}
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                border: '1px solid #cbd5e1',
                background: inCartQty >= sel.stock ? '#e2e8f0' : '#f8fafc',
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