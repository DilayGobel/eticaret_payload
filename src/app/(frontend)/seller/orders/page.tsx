// src/app/(frontend)/seller/orders/page.tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSeller } from '@/components/SellerGate'
import { api } from '@/lib/api'
import { formatTRY } from '@/lib/money'

const SHIP_STATUS: Record<string, string> = {
  label_created: 'Kargolanacak', in_transit: 'Yolda', out_for_delivery: 'Dağıtımda', delivered: 'Teslim Edildi', failed: 'Başarısız',
}
const idOf = (x: any) => String(typeof x === 'object' && x ? x.id : x)

// Satıcı sadece ÖDENMİŞ siparişleri görür: kargo kaydı ödeme onayında açıldığı için
// "kargo kaydı var" = "ödeme alındı" demektir.
export default function SellerOrders() {
  const seller = useSeller()
  const [shipments, setShipments] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [edit, setEdit] = useState<Record<string, { carrier: string; trackingNumber: string }>>({})
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [sh, it] = await Promise.all([
      api(`/shipments?where[seller][equals]=${seller.id}&limit=200&sort=-createdAt&depth=0`),
      api(`/order-items?where[seller][equals]=${seller.id}&limit=500&depth=2`),
    ])
    setShipments(sh.docs)
    setItems(it.docs)
    setEdit((cur) => {
      const next = { ...cur }
      for (const s of sh.docs) next[s.id] ??= { carrier: s.carrier || '', trackingNumber: s.trackingNumber || '' }
      return next
    })
  }, [seller.id])
  useEffect(() => { load() }, [load])

  const run = async (fn: () => Promise<any>, ok: string) => {
    setMsg('')
    try { await fn(); setMsg(ok); await load() } catch (e: any) { setMsg(e.message) }
  }

  const setItemsStatus = (lines: any[], itemStatus: string) =>
    Promise.all(lines.map((i) => api(`/order-items/${i.id}`, { method: 'PATCH', body: JSON.stringify({ itemStatus }) })))

  const prepare = (s: any, lines: any[]) =>
    run(() => setItemsStatus(lines, 'preparing'), 'Hazırlanıyor olarak işaretlendi.')

  const ship = (s: any, lines: any[]) => {
    const f = edit[s.id]
    if (!f?.carrier || !f?.trackingNumber) return setMsg('Kargo firması ve takip numarası zorunlu.')
    run(async () => {
      await api(`/shipments/${s.id}`, { method: 'PATCH', body: JSON.stringify({ carrier: f.carrier, trackingNumber: f.trackingNumber, status: 'in_transit' }) })
      await setItemsStatus(lines, 'shipped')
    }, 'Kargoya verildi.')
  }

  const deliver = (s: any, lines: any[]) =>
    run(async () => {
      await api(`/shipments/${s.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'delivered' }) })
      await setItemsStatus(lines, 'delivered')
    }, 'Teslim edildi olarak işaretlendi.')

  return (
    <>
      <h1>Siparişler</h1>
      {msg && <p className="muted">{msg}</p>}
      {shipments.length === 0 && <p className="muted">Ödemesi tamamlanmış sipariş yok.</p>}
      <div className="stack">
        {shipments.map((s) => {
          const lines = items.filter((i) => idOf(i.order) === idOf(s.order) && !['cancelled', 'refunded'].includes(i.itemStatus))
          const a = s.shippingAddress || {}
          const f = edit[s.id] || { carrier: '', trackingNumber: '' }
          return (
            <div key={s.id} className="panel stack">
              <div className="row between">
                <strong>{s.orderNumber || `#${String(s.order).slice(0, 8)}`}</strong>
                <span className="tag">{SHIP_STATUS[s.status]}</span>
              </div>

              <div className="muted">
                <div><strong>{a.fullName}</strong> · {a.phone}</div>
                <div>{a.addressLine}, {a.district}/{a.city} {a.postalCode}</div>
              </div>

              {lines.map((i) => (
                <div key={i.id} className="row between">
                  <span>{i.variant?.product?.name ?? 'Ürün'} <span className="muted">({i.variant?.sku}) × {i.quantity}</span></span>
                  <span>{formatTRY(i.unitPrice * i.quantity)}</span>
                </div>
              ))}

              {s.status === 'label_created' && (
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <input placeholder="Kargo firması" value={f.carrier} onChange={(e) => setEdit({ ...edit, [s.id]: { ...f, carrier: e.target.value } })} />
                  <input placeholder="Takip no" value={f.trackingNumber} onChange={(e) => setEdit({ ...edit, [s.id]: { ...f, trackingNumber: e.target.value } })} />
                  <button className="secondary" onClick={() => prepare(s, lines)}>Hazırlanıyor</button>
                  <button onClick={() => ship(s, lines)}>Kargoya Ver</button>
                </div>
              )}
              {s.status === 'in_transit' && (
                <div className="row between">
                  <span className="muted">{s.carrier} · {s.trackingNumber}</span>
                  <button onClick={() => deliver(s, lines)}>Teslim Edildi</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}