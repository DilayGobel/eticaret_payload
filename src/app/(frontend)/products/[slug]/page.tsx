import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { AddToCart } from './AddToCart'

const SEP = '|||'

const getProductBySlug = unstable_cache(
  async (slug: string, decodedSlug: string) => {
    const payload = await getPayload({ config })

    const res = await payload.find({
      collection: 'products',
      where:
        decodedSlug === slug
          ? { slug: { equals: slug } }
          : {
              or: [
                { slug: { equals: decodedSlug } },
                { slug: { equals: slug } },
              ],
            },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })

    const product = res.docs[0]
    if (!product) return null

    const variants = await payload.find({
      collection: 'product-variants',
      where: { product: { equals: product.id } },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const images = (product.images || [])
      .filter((i): i is any => typeof i === 'object' && Boolean(i?.url || i?.alt))
      .map((i) => {
        const rawAlt = String(i.alt || '')
        const [cleanAlt, embeddedB64] = rawAlt.includes(SEP) ? rawAlt.split(SEP) : [rawAlt, '']
        return {
          id: String(i.id),
          url: embeddedB64 || String(i.url || ''),
          alt: cleanAlt,
          filename: i.filename ? String(i.filename) : '',
        }
      })

    const seller = typeof product.seller === 'object' ? product.seller : null

    return {
      productName: product.name,
      sellerName: seller?.storeName ?? null,
      description: product.description ?? null,
      images,
      variants: variants.docs.map((v) => ({
        id: String(v.id),
        sku: v.sku,
        price: v.price,
        stock: v.stock,
        options: v.options as any,
      })),
    }
  },
  ['product-detail-v1'],
  { revalidate: 20 },
)

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const decodedSlug = decodeURIComponent(slug)

  const data = await getProductBySlug(slug, decodedSlug)
  if (!data) notFound()

  return (
    <AddToCart
      productName={data.productName}
      sellerName={data.sellerName}
      description={data.description}
      images={data.images}
      variants={data.variants}
    />
  )
}