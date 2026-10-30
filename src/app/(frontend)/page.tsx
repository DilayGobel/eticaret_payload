import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
import { formatTRY } from '@/lib/money'

const PAGE_SIZE = 12

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; page?: string }>
}) {
  const { category, q, page } = await searchParams
  const payload = await getPayload({ config })
  const pageNo = Math.max(1, Number(page) || 1)

  const categories = await payload.find({
    collection: 'categories',
    where: { isActive: { equals: true } },
    pagination: false,
    depth: 0,
    overrideAccess: false,
  })

  const and: any[] = [{ status: { equals: 'published' } }]
  if (category) and.push({ category: { equals: category } })
  if (q) and.push({ name: { like: q } })

  const products = await payload.find({
    collection: 'products',
    where: { and },
    page: pageNo,
    limit: PAGE_SIZE,
    sort: '-createdAt',
    depth: 1,
    overrideAccess: false, // anonim ziyaretçi gibi sorgula: erişim kuralları geçerli
  })

  // Kart üzerindeki "başlayan fiyat" için ürünlerin en ucuz varyantı
  const prices = new Map<string, number>()
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
      prices.set(pid, Math.min(prices.get(pid) ?? Infinity, v.price))
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
            const img = Array.isArray(p.images) && typeof p.images[0] === 'object' ? p.images[0] : null
            const price = prices.get(String(p.id))
            return (
              <Link key={p.id} href={`/products/${p.slug}`} className="card">
                {img?.url ? <img src={img.url} alt={img.alt} /> : <div className="ph" />}
                <div className="pad">
                  <div>{p.name}</div>
                  <div className="price">{price !== undefined ? formatTRY(price) : 'Stokta yok'}</div>
                </div>
              </Link>
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