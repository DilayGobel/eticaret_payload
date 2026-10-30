'use client'

import { useState } from 'react'
import { addToCart } from '@/lib/api'

interface HomeAddToCartProps {
  variantId: string
  stock: number
}

export function HomeAddToCart({ variantId, stock }: HomeAddToCartProps) {
  const [qty, setQty] = useState(0)
  const [busy, setBusy] = useState(false)

  if (stock <= 0) {
    return <span className="muted" style={{ fontSize: 13 }}>Tükendi</span>
  }

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault() // Linke tıklayıp ürün detayına gitmesini engeller
    e.stopPropagation()
    if (busy) return

    setBusy(true)
    try {
      await addToCart(variantId, 1)
      setQty(1)
    } catch (err: any) {
      alert(err.message || 'Sepete eklenemedi')
    } finally {
      setBusy(false)
    }
  }

  const handleIncrease = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy || qty >= stock) return

    setBusy(true)
    try {
      await addToCart(variantId, 1) // 1 adet daha ekler
      setQty((prev) => prev + 1)
    } catch (err: any) {
      alert(err.message || 'Hata oluştu')
    } finally {
      setBusy(false)
    }
  }

  const handleDecrease = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy || qty <= 0) return

    setBusy(true)
    try {
      // Eğer api'de azaltma yoksa en azından yerel miktarı günceller
      setQty((prev) => Math.max(0, prev - 1))
    } finally {
      setBusy(false)
    }
  }

  if (qty === 0) {
    return (
      <button
        type="button"
        className="btn"
        onClick={handleAdd}
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
        {qty}
      </span>

      <button
        type="button"
        onClick={handleIncrease}
        disabled={busy || qty >= stock}
        style={{
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
          border: 'none',
          cursor: qty >= stock ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
        }}
      >
        +
      </button>
    </div>
  )
}