'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, addToCart } from '@/lib/api'

type CartCtx = {
  qty: Record<string, number>
  loading: boolean
  count: number
  version: number
  change: (variantId: string, delta: number, selectedOptions?: Record<string, string>) => Promise<any>
  refresh: () => Promise<void>
}

const Ctx = createContext<CartCtx | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const seq = useRef(0) // eski cevapların yenisini ezmesini engeller

  const refresh = useCallback(async () => {
    const mine = ++seq.current
    try {
      const res = await api('/carts/summary')
      if (mine !== seq.current) return // daha yeni bir istek başladı, bunu yok say
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
    async (variantId: string, delta: number, selectedOptions?: Record<string, string>) => {
      const id = String(variantId)
      // İyimser güncelleme: UI anında değişsin
      setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) + delta) }))
      try {
        const res = await addToCart(id, delta, selectedOptions)
        seq.current++ // uçuştaki eski refresh cevaplarını geçersiz kıl
        // Sunucunun gerçek değeriyle düzelt (stok sınırı vb.), ekstra GET yok
        setQty((q) => ({ ...q, [String(res.variantId || id)]: res.quantity }))
        setVersion((v) => v + 1) // sadece 1 kez
        return res
      } catch (e) {
        await refresh() // hata olursa gerçek durumu geri yükle
        throw e
      }
    },
    [refresh],
  )

  const count = useMemo(() => Object.values(qty).reduce((s, n) => s + n, 0), [qty])
  const value = useMemo(
    () => ({ qty, loading, count, version, change, refresh }),
    [qty, loading, count, version, change, refresh],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCart, CartProvider içinde kullanılmalı')
  return c
}

export function useCartDetails() {
  const { version } = useCart()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Erişim kuralı zaten sadece kendi sepetini döndürüyor: summary çağrısı gereksiz
        const res = await api('/cart-items?depth=3&limit=100&sort=createdAt')
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