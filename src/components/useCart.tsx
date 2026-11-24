'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, addToCart } from '@/lib/api'

type CartCtx = {
  qty: Record<string, number>
  loading: boolean
  count: number
  version: number
  syncVersion: number
  change: (variantId: string, delta: number, selectedOptions?: Record<string, string>) => Promise<any>
  refresh: () => Promise<void>
}

const Ctx = createContext<CartCtx | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const [syncVersion, setSyncVersion] = useState(0)

  const seq = useRef(0)
  const pendingDelta = useRef<Record<string, number>>({})
  const pendingOptions = useRef<Record<string, Record<string, string> | undefined>>({})
  const inFlight = useRef<Record<string, boolean>>({})

  const refresh = useCallback(async () => {
    const mine = ++seq.current
    try {
      const res = await api('/carts/summary')
      if (mine !== seq.current) return
      const next: Record<string, number> = {}
      for (const i of res.items || []) next[i.variantId] = i.quantity
      setQty(next)
      setVersion((v) => v + 1)
      setSyncVersion((v) => v + 1)
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
    async (variantId: string, delta: number, selectedOptions?: Record<string, string>) => {
      const id = String(variantId)

      // 1. UI'ı anında güncelle (0ms)
      setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) + delta) }))
      setVersion((v) => v + 1)

      // 2. Hızlı ardışık tıklamaları tek bir delta altında biriktir
      pendingDelta.current[id] = (pendingDelta.current[id] || 0) + delta
      if (selectedOptions) pendingOptions.current[id] = selectedOptions

      if (inFlight.current[id]) return

      inFlight.current[id] = true
      let lastRes: any = null
      try {
        while (pendingDelta.current[id]) {
          const stepDelta = pendingDelta.current[id]
          const stepOpts = pendingOptions.current[id]
          pendingDelta.current[id] = 0

          lastRes = await addToCart(id, stepDelta, stepOpts)
          seq.current++
        }

        if (lastRes) {
          setQty((q) => ({ ...q, [String(lastRes.variantId || id)]: lastRes.quantity }))
          setVersion((v) => v + 1)
        }
        return lastRes
      } catch (e) {
        pendingDelta.current[id] = 0
        await refresh()
        throw e
      } finally {
        inFlight.current[id] = false
      }
    },
    [refresh],
  )

  const count = useMemo(() => Object.values(qty).reduce((s, n) => s + n, 0), [qty])
  const value = useMemo(
    () => ({ qty, loading, count, version, syncVersion, change, refresh }),
    [qty, loading, count, version, syncVersion, change, refresh],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCart, CartProvider içinde kullanılmalı')
  return c
}

export function useCartDetails() {
  const { qty, syncVersion } = useCart()
  const [rawItems, setRawItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Sadece ilk yüklemede, giriş/çıkışta veya listede olmayan yeni bir varyant eklendiğinde sunucuya git
  const hasUnfetchedVariant = useMemo(() => {
    const known = new Set(rawItems.map((i) => String(typeof i.variant === 'object' ? i.variant?.id : i.variant)))
    return Object.entries(qty).some(([id, q]) => q > 0 && !known.has(id))
  }, [qty, rawItems])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api('/cart-items?depth=2&limit=100&sort=createdAt')
        if (!cancelled) setRawItems(res.docs || [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [syncVersion, hasUnfetchedVariant])

  // Sepet sayfasındaki miktar ve ara toplamı anlık (optimistic) yansıt
  const items = useMemo(() => {
    return rawItems
      .map((item) => {
        const vid = String(typeof item.variant === 'object' ? item.variant?.id : item.variant)
        const liveQty = qty[vid] !== undefined ? qty[vid] : item.quantity
        return { ...item, quantity: liveQty }
      })
      .filter((item) => item.quantity > 0)
  }, [rawItems, qty])

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + (i.variant?.price ?? 0) * i.quantity, 0),
    [items],
  )

  return { items, loading, subtotal }
}