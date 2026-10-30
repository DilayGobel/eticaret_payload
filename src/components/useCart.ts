'use client'
import { useCallback, useEffect, useState } from 'react'
import { api, getCart } from '@/lib/api'

// Sepet kalemlerini (variant -> product -> images) getirir ve ara toplamı hesaplar.
export function useCart() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const cart = await getCart()
      if (!cart) return setItems([])
      const res = await api(`/cart-items?where[cart][equals]=${cart.id}&depth=3&limit=100&sort=createdAt`)
      // Yayından kalkmış üründe variant/product obje olarak gelmez, onları ayıkla
      setItems(res.docs.filter((i: any) => typeof i.variant === 'object' && typeof i.variant?.product === 'object'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
    window.addEventListener('cart-changed', reload)
    return () => window.removeEventListener('cart-changed', reload)
  }, [reload])

  const subtotal = items.reduce((s, i) => s + i.variant.price * i.quantity, 0)
  const count = items.reduce((s, i) => s + i.quantity, 0)
  return { items, loading, subtotal, count, reload }
}