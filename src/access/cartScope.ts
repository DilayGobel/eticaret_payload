import type { PayloadRequest } from 'payload'

export function getGuestToken(req: PayloadRequest): string | null {
  return req.headers.get('x-guest-token')
}

// Giriş yapmış kullanıcının ya da misafirin erişebileceği sepet ID'lerini bulur.
export async function getOwnCartIds(req: PayloadRequest): Promise<string[]> {
  if (req.user) {
    const carts = await req.payload.find({
      collection: 'carts',
      where: { user: { equals: req.user.id } },
      pagination: false,
      depth: 0,
    })
    return carts.docs.map((c) => String(c.id))
  }

  const guestToken = getGuestToken(req)
  if (!guestToken) return []

  const carts = await req.payload.find({
    collection: 'carts',
    where: { guestToken: { equals: guestToken } },
    pagination: false,
    depth: 0,
  })
  return carts.docs.map((c) => String(c.id))
}