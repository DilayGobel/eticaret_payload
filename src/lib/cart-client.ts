const COOKIE = 'guest_token'

export function getGuestToken(): string {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`))
  if (match) return decodeURIComponent(match.split('=')[1])

  const token = crypto.randomUUID()
  document.cookie = `${COOKIE}=${token}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
  return token
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'x-guest-token': getGuestToken(),
      ...(init.headers || {}),
    },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.message || data?.message || 'İşlem başarısız.')
  }
  return data
}

// Kullanıcının (ya da misafirin) sepetini bulur, yoksa oluşturur.
async function getOrCreateCartId(): Promise<string> {
  const found = await api('/carts?limit=1&depth=0')
  if (found.docs?.[0]) return found.docs[0].id

  const created = await api('/carts', { method: 'POST', body: '{}' })
  return created.doc.id
}

export async function addToCart(variantId: string, quantity: number) {
  const cartId = await getOrCreateCartId()

  const existing = await api(
    `/cart-items?where[cart][equals]=${cartId}&where[variant][equals]=${variantId}&limit=1&depth=0`,
  )
  const item = existing.docs?.[0]

  if (item) {
    await api(`/cart-items/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity: item.quantity + quantity }),
    })
  } else {
    await api('/cart-items', {
      method: 'POST',
      body: JSON.stringify({ cart: cartId, variant: variantId, quantity }),
    })
  }
}

export async function getCartItems() {
  const data = await api('/cart-items?depth=2&limit=100')
  return data.docs as any[]
}

export async function updateQuantity(itemId: string, quantity: number) {
  await api(`/cart-items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) })
}

export async function removeItem(itemId: string) {
  await api(`/cart-items/${itemId}`, { method: 'DELETE' })
}

// Giriş/kayıt sonrası: misafir sepetini kullanıcı sepetine birleştirir.
export async function mergeGuestCart() {
  try {
    await api('/carts/merge-guest', {
      method: 'POST',
      body: JSON.stringify({ guestToken: getGuestToken() }),
    })
  } catch {
    // Birleştirilecek sepet yoksa sessizce geç
  }
}