'use client'

import { useState } from 'react'
import { addToCart } from '@/lib/api'
import { useCart } from '@/components/useCart'

interface HomeAddToCartProps {
  variantId: string | number
  stock: number
}

export function HomeAddToCart({ variantId, stock }: HomeAddToCartProps) {
  const { items, loading, reload } = useCart()
  const [busy, setBusy] = useState(false)

  // Hem obje hem string/number durumlarını kapsayan güvenli ID eşleşmesi
  const targetId = String(variantId)
  const cartItem = items.find((item: any) => {
    const rawVariant = item.variant
    const vId = typeof rawVariant === 'object' && rawVariant !== null 
      ? (rawVariant.id || rawVariant._id) 
      : rawVariant
    return String(vId) === targetId
  })

  const currentQty = cartItem?.quantity || 0

  if (stock <= 0) {
    return <span className="muted" style={{ fontSize: 13 }}>Tükendi</span>
  }

  // useCart ilk yüklendiğinde yanlışlıkla "Sepete Ekle" gösterip zıplamaması için
  if (loading && currentQty === 0) {
    return (
      <span className="muted" style={{ fontSize: 12, padding: '6px 8px' }}>
        ...
      </span>
    )
  }

  const handleIncrease = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy || currentQty >= stock) return

    setBusy(true)
    try {
      await addToCart(String(variantId), 1)
      window.dispatchEvent(new Event('cart-changed'))
      await reload()
    } catch (err: any) {
      alert(err.message || 'Hata oluştu')
    } finally {
      setBusy(false)
    }
  }

  const handleDecrease = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy || currentQty <= 0) return

    setBusy(true)
    try {
      await addToCart(String(variantId), -1)
      window.dispatchEvent(new Event('cart-changed'))
      await reload()
    } catch (err: any) {
      alert(err.message || 'Hata oluştu')
    } finally {
      setBusy(false)
    }
  }

  if (currentQty === 0) {
    return (
      <button
        type="button"
        className="btn"
        onClick={handleIncrease}
        disabled={busy}
        style={{
          padding: '6px 12px',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        {busy ? '...' : '+ Sepete Ekle'}
      </button>
    )
  }

  return (
    <div
      className="row"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      style={{
        alignItems: 'center',
        gap: 6,
        background: 'rgba(255,255,255,0.06)',
        padding: '3px 6px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <button
        type="button"
        onClick={handleDecrease}
        disabled={busy}
        style={{
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
          border: 'none',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        -
      </button>

      <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 600, fontSize: 14 }}>
        {currentQty}
      </span>

      <button
        type="button"
        onClick={handleIncrease}
        disabled={busy || currentQty >= stock}
        style={{
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
          border: 'none',
          cursor: currentQty >= stock ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
        }}
      >
        +
      </button>
    </div>
  )
}