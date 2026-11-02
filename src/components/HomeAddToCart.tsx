'use client'

import { useState } from 'react'
import { useCart } from '@/components/useCart'

interface HomeAddToCartProps {
  variantId: string | number
  stock: number
}

export function HomeAddToCart({ variantId, stock }: HomeAddToCartProps) {
  const { qty, loading, change } = useCart()
  const [busy, setBusy] = useState(false)
  const id = String(variantId)
  const currentQty = qty[id] || 0

  if (stock <= 0) return <span className="muted" style={{ fontSize: 13 }}>Tükendi</span>
  if (loading && currentQty === 0) {
    return <span className="muted" style={{ fontSize: 12, padding: '6px 8px' }}>...</span>
  }

  const act = (delta: number) => async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (delta > 0 && currentQty >= stock) return
    if (delta < 0 && currentQty <= 0) return
    setBusy(true)
    try {
      await change(id, delta)
    } catch (err: any) {
      alert(err.message || 'Hata oluştu')
    } finally {
      setBusy(false)
    }
  }

  if (currentQty === 0) {
    return (
      <button type="button" className="btn" onClick={act(1)} disabled={busy}
        style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>
        + Sepete Ekle
      </button>
    )
  }

  return (
    <div className="row" onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
      style={{ alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', padding: '3px 6px',
               borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }}>
      <button type="button" onClick={act(-1)}
        style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                 borderRadius: 4, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
      <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 600, fontSize: 14 }}>{currentQty}</span>
      <button type="button" onClick={act(1)} disabled={currentQty >= stock}
        style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                 borderRadius: 4, border: 'none', cursor: currentQty >= stock ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>+</button>
    </div>
  )
}