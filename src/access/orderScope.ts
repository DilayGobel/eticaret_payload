import type { PayloadRequest } from 'payload'

// Giriş yapmış müşterinin kendi sipariş ID'lerini bulur (order_items ve
// payments koleksiyonlarında "bu sipariş bana mı ait" kontrolü için).
export async function getOwnOrderIds(req: PayloadRequest): Promise<string[]> {
  if (!req.user) return []

  const orders = await req.payload.find({
    collection: 'orders',
    where: { customer: { equals: req.user.id } },
    pagination: false,
    depth: 0,
  })

  return orders.docs.map((o) => String(o.id))
}