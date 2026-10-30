'use client'
// Tarayıcıdan Payload REST API'sine giden ince katman.
// Misafir sepeti için x-guest-token header'ı her istekte otomatik eklenir.

const GUEST_KEY = 'guestToken'

export function getGuestToken(): string {
  let t = localStorage.getItem(GUEST_KEY)
  if (!t) {
    t = crypto.randomUUID()
    localStorage.setItem(GUEST_KEY, t)
  }
  return t
}
export const hasGuestToken = () => Boolean(localStorage.getItem(GUEST_KEY))
export const clearGuestToken = () => localStorage.removeItem(GUEST_KEY)

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-guest-token': getGuestToken(),
      ...(init.headers || {}),
    },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error || data?.errors?.[0]?.message || 'İstek başarısız oldu.')
  }
  return data as T
}

export const notifyCartChanged = () => window.dispatchEvent(new Event('cart-changed'))

// ───────── Sepet ─────────
export async function getCart() {
  const res = await api('/carts?limit=1&depth=0')
  return res.docs[0] ?? null
}

async function ensureCart() {
  return (await getCart()) ?? (await api('/carts', { method: 'POST', body: '{}' })).doc
}

export async function addToCart(variantId: string, quantity = 1) {
  const cart = await ensureCart()
  const found = await api(
    `/cart-items?where[cart][equals]=${cart.id}&where[variant][equals]=${variantId}&limit=1&depth=0`,
  )
  const existing = found.docs[0]
  if (existing) {
    await api(`/cart-items/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity: existing.quantity + quantity }),
    })
  } else {
    await api('/cart-items', {
      method: 'POST',
      body: JSON.stringify({ cart: cart.id, variant: variantId, quantity }),
    })
  }
  notifyCartChanged()
}

export async function updateCartItem(id: string, quantity: number) {
  await api(`/cart-items/${id}`, { method: 'PATCH', body: JSON.stringify({ quantity }) })
  notifyCartChanged()
}

export async function removeCartItem(id: string) {
  await api(`/cart-items/${id}`, { method: 'DELETE' })
  notifyCartChanged()
}

/**
 * Payload CMS /api/media koleksiyonuna dosya yükler.
 */
export async function uploadMedia(file: File, alt?: string) {
  const formData = new FormData()
  formData.append('file', file)
  if (alt) {
    formData.append('alt', alt)
  }

  const res = await fetch('/api/media', {
    method: 'POST',
    credentials: 'include', // Oturum çerezini (payload-token) iletmek için şart
    body: formData,
    // NOT: 'Content-Type' başlığını elle EKLEME, tarayıcı boundary ile kendisi ayarlar.
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.errors?.[0]?.message || errorData.error || 'Görsel yüklenemedi.')
  }

  const data = await res.json()
  // Payload POST cevabında dönen döküman doc veya doğrudan id şeklinde olabilir
  return data.doc || data
}