// src/app/(frontend)/seller/earnings/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useSeller } from '@/components/SellerGate'
import { api } from '@/lib/api'
import { formatTRY } from '@/lib/money'

const idOf = (x: any) => String(typeof x === 'object' && x ? x.id : x)

export default function SellerEarnings() {
  const seller = useSeller()
  const [rows, setRows] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      api(`/order-items?where[seller][equals]=${seller.id}&limit=1000&depth=2&sort=-createdAt`),
      api(`/shipments?where[seller][equals]=${seller.id}&limit=1000&depth=0`),
    ]).then(([it, sh]) => {
      const paidOrders = new Set(sh.docs.map((s: any) => idOf(s.order))) // kargo kaydı = ödeme alındı
      setRows(it.docs.filter((i: any) => paidOrders.has(idOf(i.order))))
      setLoaded(true)
    })
  }, [seller.id])

  // İade ve iptal edilen kalemler hakedişten hariç tutulur (tutar kayıtta durur, silinmez).
  const valid = rows.filter((i) => !['cancelled', 'refunded'].includes(i.itemStatus))
  const sum = (list: any[], k: string) => list.reduce((s, i) => s + i[k], 0)
  const ready = valid.filter((i) => i.itemStatus === 'delivered')
  const waiting = valid.filter((i) => i.itemStatus !== 'delivered')
  const excluded = rows.filter((i) => ['cancelled', 'refunded'].includes(i.itemStatus))

  const commission = (list: any[]) => list.reduce((s, i) => s + (i.unitPrice * i.quantity - i.sellerPayout), 0)

  if (!loaded) return <p className="muted">Yükleniyor…</p>

  return (
    <>
      <h1>Hakediş</h1>
      <div className="grid" style={{ marginBottom: 24 }}>
        <div className="panel"><div className="muted">Ödemeye hazır (teslim edilenler)</div><div className="price" style={{ fontSize: 26 }}>{formatTRY(sum(ready, 'sellerPayout'))}</div></div>
        <div className="panel"><div className="muted">Bekleyen (teslim edilmemiş)</div><div className="price" style={{ fontSize: 26 }}>{formatTRY(sum(waiting, 'sellerPayout'))}</div></div>
        <div className="panel"><div className="muted">Kesilen komisyon</div><div style={{ fontSize: 26 }}>{formatTRY(commission(valid))}</div></div>
      </div>
      <p className="muted">Ödemeler {seller.payoutIban} IBAN’ına yapılır. İade/iptal edilen {excluded.length} kalem hesaba katılmadı.</p>

      <div className="panel">
        {rows.length === 0 && <p className="muted">Henüz satış yok.</p>}
        {rows.map((i) => (
          <div key={i.id} className="line">
            <div style={{ flex: 1 }}>
              <div>{i.variant?.product?.name ?? 'Ürün'} × {i.quantity}</div>
              <div className="muted">Satış {formatTRY(i.unitPrice * i.quantity)} · komisyon %{i.commissionRate} · {new Date(i.createdAt).toLocaleDateString('tr-TR')}</div>
            </div>
            <span className="tag">{i.itemStatus}</span>
            <strong style={{ textDecoration: ['cancelled', 'refunded'].includes(i.itemStatus) ? 'line-through' : 'none' }}>{formatTRY(i.sellerPayout)}</strong>
          </div>
        ))}
      </div>
    </>
  )
}