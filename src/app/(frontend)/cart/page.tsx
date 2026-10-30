'use client'
import Link from 'next/link'
import { useCart } from '@/components/useCart'
import { removeCartItem, updateCartItem } from '@/lib/api'
import { formatTRY } from '@/lib/money'
import { calcShipping, FREE_SHIPPING_THRESHOLD } from '@/utils/coupon'

export default function CartPage() {
  const { items, loading, subtotal } = useCart()
  if (loading) return <p className="muted">Yükleniyor…</p>
  if (items.length === 0) return (
    <div className="panel stack"><h1>Sepetiniz boş</h1><Link className="btn" href="/">Alışverişe başla</Link></div>
  )
  const shipping = calcShipping(subtotal)

  return (
    <div className="two" style={{ gridTemplateColumns: '2fr 1fr' }}>
      <div>
        <h1>Sepetim</h1>
        {items.map((i) => {
          const v = i.variant
          const p = v.product
          const img = Array.isArray(p.images) && typeof p.images[0] === 'object' ? p.images[0] : null
          return (
            <div key={i.id} className="line">
              {img?.url ? <img src={img.url} alt={img.alt} /> : <div className="ph" />}
              <div style={{ flex: 1 }}>
                <Link href={`/products/${p.slug}`}>{p.name}</Link>
                <div className="muted">{v.options ? Object.values(v.options).join(' / ') : v.sku}</div>
                <div className="price">{formatTRY(v.price)}</div>
              </div>
              <input type="number" min={1} max={v.stock} value={i.quantity} style={{ width: 70 }}
                onChange={(e) => updateCartItem(i.id, Math.max(1, Math.min(v.stock, Number(e.target.value) || 1)))} />
              <button className="secondary" onClick={() => removeCartItem(i.id)}>Sil</button>
            </div>
          )
        })}
      </div>
      <div className="panel stack" style={{ alignSelf: 'start' }}>
        <h3 style={{ margin: 0 }}>Özet</h3>
        <div className="row between"><span>Ara toplam</span><span>{formatTRY(subtotal)}</span></div>
        <div className="row between"><span>Kargo</span><span>{shipping === 0 ? 'Ücretsiz' : formatTRY(shipping)}</span></div>
        {shipping > 0 && <div className="muted">{formatTRY(FREE_SHIPPING_THRESHOLD)} üzeri kargo ücretsiz</div>}
        <div className="row between"><strong>Toplam</strong><strong>{formatTRY(subtotal + shipping)}</strong></div>
        <Link className="btn" href="/checkout" style={{ textAlign: 'center' }}>Ödemeye Geç</Link>
        <div className="muted">Kupon indirimi bir sonraki adımda uygulanır.</div>
      </div>
    </div>
  )
}