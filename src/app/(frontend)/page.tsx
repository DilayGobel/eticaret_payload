import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ProductCard, type CardVariant } from '@/components/ProductCard'

const PAGE_SIZE = 12
const SEP = '|||'

const getHomeData = unstable_cache(
  async (category: string, q: string, pageNo: number) => {
    const payload = await getPayload({ config })

    const and: any[] = [{ status: { equals: 'published' } }]
    if (category) and.push({ category: { equals: category } })
    if (q) and.push({ name: { like: q } })

    const [categoriesRes, productsRes] = await Promise.all([
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

    const variantsByProduct: Record<string, CardVariant[]> = {}
    if (productsRes.docs.length) {
      const variantsRes = await payload.find({
        collection: 'product-variants',
        where: { product: { in: productsRes.docs.map((p) => p.id) } },
        pagination: false,
        depth: 0,
        overrideAccess: false,
      })

      for (const v of variantsRes.docs) {
        const pid = String(v.product)
        if (!variantsByProduct[pid]) variantsByProduct[pid] = []
        variantsByProduct[pid].push({
          id: String(v.id),
          price: v.price,
          stock: v.stock,
          options: v.options as any,
        })
      }
    }

    const categories = categoriesRes.docs.map((c) => ({
      id: String(c.id),
      name: c.name,
    }))

    const products = productsRes.docs.map((p) => {
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

      return {
        id: String(p.id),
        slug: p.slug,
        name: p.name,
        images: imgs,
      }
    })

    return {
      categories,
      products,
      variantsByProduct,
      totalDocs: productsRes.totalDocs,
      totalPages: productsRes.totalPages,
      hasPrevPage: productsRes.hasPrevPage,
      hasNextPage: productsRes.hasNextPage,
    }
  },
  ['home-products-v1'],
  { revalidate: 20 },
)

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>
}) {
  const { category, q, page } = await searchParams
  const pageNo = Math.max(1, Number(page) || 1)

  const data = await getHomeData(category ?? '', q ?? '', pageNo)

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
        {data.categories.map((c) => (
          <Link key={c.id} href={link({ category: c.id, page: undefined })} className={`chip ${category === c.id ? 'active' : ''}`}>
            {c.name}
          </Link>
        ))}
      </div>

      {q && <p className="muted">“{q}” için {data.totalDocs} sonuç</p>}

      {data.products.length === 0 ? (
        <p className="muted">Ürün bulunamadı.</p>
      ) : (
        <div className="grid">
          {data.products.map((p) => (
            <ProductCard
              key={p.id}
              slug={p.slug}
              name={p.name}
              images={p.images}
              variants={data.variantsByProduct[p.id] ?? []}
            />
          ))}
        </div>
      )}

      {data.totalPages > 1 && (
        <div className="pager">
          {data.hasPrevPage && <Link className="btn secondary" href={link({ page: String(pageNo - 1) })}>← Önceki</Link>}
          <span className="muted">{pageNo} / {data.totalPages}</span>
          {data.hasNextPage && <Link className="btn secondary" href={link({ page: String(pageNo + 1) })}>Sonraki →</Link>}
        </div>
      )}
    </>
  )
}