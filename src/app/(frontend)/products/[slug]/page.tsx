import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { AddToCart } from './AddToCart'

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const decodedSlug = decodeURIComponent(slug) // URL'deki %C3%B6 gibi karakterleri düzeltir

  const payload = await getPayload({ config })

  const res = await payload.find({
    collection: 'products',
    where: {
      or: [
        { slug: { equals: decodedSlug } },
        { slug: { equals: slug } },
      ],
    },
    limit: 1,
    depth: 2,
    overrideAccess: true,
  })
  const product = res.docs[0]
  if (!product) notFound()

  const variants = await payload.find({
    collection: 'product-variants',
    where: { product: { equals: product.id } },
    pagination: false,
    depth: 0,
    overrideAccess: true, // true yapıldı
  })

  const images = (product.images || []).filter((i): i is any => typeof i === 'object')
  const seller = typeof product.seller === 'object' ? product.seller : null

  return (
    <div className="two">
      <div className="stack">
        {images[0]?.url ? <img src={images[0].url} alt={images[0].alt} style={{ width: '100%', borderRadius: 12 }} /> : <div className="ph" style={{ borderRadius: 12 }} />}
        <div className="row">
          {images.slice(1, 5).map((i) => (
            <img key={i.id} src={i.url} alt={i.alt} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
          ))}
        </div>
      </div>
      <div className="stack">
        <h1>{product.name}</h1>
        {seller && <div className="muted">Satıcı: {seller.storeName}</div>}
        <p>{product.description}</p>
        <AddToCart
          variants={variants.docs.map((v) => ({ id: String(v.id), sku: v.sku, price: v.price, stock: v.stock, options: v.options as any }))}
        />
      </div>
    </div>
  )
}