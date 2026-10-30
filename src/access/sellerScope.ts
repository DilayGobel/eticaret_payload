import type { PayloadRequest } from 'payload'

// Giriş yapmış kullanıcının sahip olduğu satıcı (mağaza) kaydının ID'sini bulur.
export async function getOwnSellerId(req: PayloadRequest): Promise<string | null> {
  if (!req.user) return null

  const sellers = await req.payload.find({
    collection: 'sellers',
    where: { owner: { equals: req.user.id } },
    limit: 1,
    depth: 0,
  })

  return sellers.docs[0]?.id ? String(sellers.docs[0].id) : null
}

// Giriş yapmış satıcının sahip olduğu tüm ürünlerin ID listesini döner.
// product_variants gibi iki seviye derin ilişkilerde bunu kullanıyoruz.
export async function getOwnProductIds(req: PayloadRequest): Promise<string[]> {
  const sellerId = await getOwnSellerId(req)
  if (!sellerId) return []

  const products = await req.payload.find({
    collection: 'products',
    where: { seller: { equals: sellerId } },
    pagination: false,
    depth: 0,
  })

  return products.docs.map((p) => String(p.id))
}

// Satıcının sahip olduğu TÜM varyant ID'lerini döner (inventory_logs için).
export async function getOwnVariantIds(req: PayloadRequest): Promise<string[]> {
  const productIds = await getOwnProductIds(req)
  if (productIds.length === 0) return []

  const variants = await req.payload.find({
    collection: 'product-variants',
    where: { product: { in: productIds } },
    pagination: false,
    depth: 0,
  })

  return variants.docs.map((v) => String(v.id))
}