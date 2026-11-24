import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ProductCard, type CardVariant } from '@/components/ProductCard'

const PAGE_SIZE = 12
const SEP = '|||'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>
}) {
  const { category, q, page } = await searchParams
  const payload = await getPayload({ config })
  const pageNo = Math.max(1, Number(page) || 1)

  const and: any[] = [{ status: { equals: 'published' } }]
  if (category) and.push({ category: { equals: category } })
  if (q) and.push({ name: { like: q } })

  const [categories, products] = await Promise.all([
    payload.find({
      collection: 'categories',
      where: { isActive: { equals: true } },
      pagination: false,
      depth: 0,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'products',
      where: { and },
      page: pageNo,
      limit: PAGE_SIZE,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: false,
    }),
  ])

  // Varyantları ve en ucuz fiyat / stok bilgisini eşleştir
  const variantsByProduct = new Map<string, CardVariant[]>()
  if (products.docs.length) {
    const variants = await payload.find({
      collection: 'product-variants',
      where: { product: { in: products.docs.map((p) => p.id) } },
      pagination: false,
      depth: 0,
      overrideAccess: false,
    })

    for (const v of variants.docs) {
      const pid = String(v.product)
      const list = variantsByProduct.get(pid) ?? []
      list.push({
        id: String(v.id),
        price: v.price,
        stock: v.stock,
        options: v.options as any,
      })
      variantsByProduct.set(pid, list)
    }
  }

  const link = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    Object.entries({ category, q, ...params }).forEach(([k, v]) => v && sp.set(k, v))
    const s = sp.toString()
    return s ? `/?${s}` : '/'
  }

  return (
    <>
      <div className="chips">
        <Link href={link({ category: undefined, page: undefined })} className={`chip ${!category ? 'active' : ''}`}>Tümü</Link>
        {categories.docs.map((c) => (
          <Link key={c.id} href={link({ category: c.id, page: undefined })} className={`chip ${category === c.id ? 'active' : ''}`}>
            {c.name}
          </Link>
        ))}
      </div>

      {q && <p className="muted">“{q}” için {products.totalDocs} sonuç</p>}

      {products.docs.length === 0 ? (
        <p className="muted">Ürün bulunamadı.</p>
      ) : (
        <div className="grid">
          {products.docs.map((p) => {
            const imgs = (Array.isArray(p.images) ? p.images : [])
              .filter((i): i is any => typeof i === 'object' && Boolean(i?.url || i?.alt))
              .map((i) => {
                const rawAlt = String(i.alt || '')
                const [cleanAlt, embeddedB64] = rawAlt.includes(SEP)
                  ? rawAlt.split(SEP)
                  : [rawAlt, '']
                return {
                  id: String(i.id),
                  url: embeddedB64 || String(i.url || ''),
                  alt: cleanAlt,
                  filename: i.filename ? String(i.filename) : '',
                }
              })

            return (
              <ProductCard
                key={p.id}
                slug={p.slug}
                name={p.name}
                images={imgs}
                variants={variantsByProduct.get(String(p.id)) ?? []}
              />
            )
          })}
        </div>
      )}

      {products.totalPages > 1 && (
        <div className="pager">
          {products.hasPrevPage && <Link className="btn secondary" href={link({ page: String(pageNo - 1) })}>← Önceki</Link>}
          <span className="muted">{pageNo} / {products.totalPages}</span>
          {products.hasNextPage && <Link className="btn secondary" href={link({ page: String(pageNo + 1) })}>Sonraki →</Link>}
        </div>
      )}
    </>
  )
}