'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, addToCart } from '@/lib/api'

type CartCtx = {
  qty: Record<string, number>
  loading: boolean
  count: number
  version: number
  change: (variantId: string, delta: number) => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<CartCtx | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const pending = useRef<Record<string, number>>({})

  const refresh = useCallback(async () => {
    try {
      const res = await api('/carts/summary')
      const next: Record<string, number> = {}
      for (const i of res.items || []) next[i.variantId] = i.quantity
      setQty(next)
      setVersion((v) => v + 1)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
  refresh()
  window.addEventListener('cart-changed', refresh)
  return () => window.removeEventListener('cart-changed', refresh)
}, [refresh])

  const change = useCallback(
    async (variantId: string, delta: number) => {
      setQty((q) => ({ ...q, [variantId]: Math.max(0, (q[variantId] || 0) + delta) }))
      pending.current[variantId] = (pending.current[variantId] || 0) + 1
      try {
        const res = await addToCart(variantId, delta)
        if (pending.current[variantId] === 1) {
          setQty((q) => ({ ...q, [variantId]: res.quantity }))
        }
        setVersion((v) => v + 1)
      } catch (e) {
        await refresh()
        throw e
      } finally {
        pending.current[variantId] -= 1
      }
    },
    [refresh],
  )

  const count = useMemo(() => Object.values(qty).reduce((s, n) => s + n, 0), [qty])

  return (
    <Ctx.Provider value={{ qty, loading, count, version, change, refresh }}>
      {children}
    </Ctx.Provider>
  )
}

export function useCart() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCart, CartProvider içinde kullanılmalı')
  return c
}

// Sepet / ödeme sayfaları için: detaylı (ağır) veri sadece orada çekilir.
export function useCartDetails() {
  const { version } = useCart()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const cart = await api('/carts/summary')
          if (!cart.cartId) {
            if (!cancelled) setItems([])
            return
          }
          const res = await api(
            `/cart-items?where[cart][equals]=${cart.cartId}&depth=3&limit=100&sort=createdAt`,
          )
          if (!cancelled) setItems(res.docs || [])
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    return () => {
      cancelled = true
    }
  }, [version])

  const subtotal = items.reduce((s, i) => s + (i.variant?.price ?? 0) * i.quantity, 0)
  return { items, loading, subtotal }
}