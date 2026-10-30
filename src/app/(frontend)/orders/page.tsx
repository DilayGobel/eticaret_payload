'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/Providers'
import { api } from '@/lib/api'
import { formatTRY } from '@/lib/money'

const ORDER_STATUS: Record<string, string> = { pending_payment: 'Ödeme Bekleniyor', paid: 'Ödendi', cancelled: 'İptal Edildi', completed: 'Tamamlandı' }
const ITEM_STATUS: Record<string, string> = { pending: 'Bekliyor', preparing: 'Hazırlanıyor', shipped: 'Kargolandı', delivered: 'Teslim Edildi', cancelled: 'İptal', refunded: 'İade Edildi' }
const REFUND_REASONS: Record<string, string> = { damaged_product: 'Hasarlı ürün', wrong_item: 'Yanlış ürün', size_exchange: 'Beden/ürün değişimi', not_as_described: 'Açıklamaya uygun değil' }

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [refunds, setRefunds] = useState<any[]>([])
  const [shipments, setShipments] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [reason, setReason] = useState('damaged_product')

  const load = useCallback(async () => {
    const o = await api('/orders?sort=-createdAt&depth=0&limit=50')
    setOrders(o.docs)
    if (o.docs.length === 0) return
    const ids = o.docs.map((x: any) => x.id).join(',')
    const [it, rf, sh] = await Promise.all([
      api(`/order-items?where[order][in]=${ids}&depth=3&limit=500`),
      api('/refund-requests?depth=0&limit=200'),
      api(`/shipments?where[order][in]=${ids}&depth=0&limit=200`),
    ])
    setItems(it.docs); setRefunds(rf.docs); setShipments(sh.docs)
  }, [])

  useEffect(() => { if (user) load() }, [user, load])

  const act = async (fn: () => Promise<any>, ok: string) => {
    setMsg('')
    try { await fn(); setMsg(ok); await load() } catch (e: any) { setMsg(e.message) }
  }

  if (authLoading) return <p className="muted">Yükleniyor…</p>
  if (!user) return <div className="panel"><Link href="/login">Siparişlerini görmek için giriş yap</Link></div>

  return (
    <>
      <h1>Siparişlerim</h1>
      {msg && <p className="muted">{msg}</p>}
      {orders.length === 0 && <p className="muted">Henüz siparişin yok.</p>}
      <div className="stack">
        {orders.map((o) => {
          const lines = items.filter((i) => String(typeof i.order === 'object' ? i.order.id : i.order) === String(o.id))
          return (
            <div key={o.id} className="panel stack">
              <div className="row between">
                <div><strong>{o.orderNumber}</strong> <span className="tag">{ORDER_STATUS[o.status] ?? o.status}</span></div>
                <strong>{formatTRY(o.finalAmount)}</strong>
              </div>
              <div className="muted">{new Date(o.createdAt).toLocaleString('tr-TR')}</div>

              {lines.map((i) => {
                const sh = shipments.find((s) => String(s.seller) === String(typeof i.seller === 'object' ? i.seller.id : i.seller) && String(s.order) === String(o.id))
                const rf = refunds.find((r) => String(r.orderItem) === String(i.id))
                return (
                  <div key={i.id} className="line">
                    <div style={{ flex: 1 }}>
                      <div>{i.variant?.product?.name ?? 'Ürün'} × {i.quantity}</div>
                      <div className="muted">{formatTRY(i.unitPrice)} · <span className="tag">{ITEM_STATUS[i.itemStatus]}</span>
                        {sh?.trackingNumber && <> · {sh.carrier} #{sh.trackingNumber}</>}
                      </div>
                    </div>
                    {rf ? <span className="tag">İade: {rf.status}</span>
                      : i.itemStatus === 'delivered' && (
                        <div className="row">
                          <select value={reason} onChange={(e) => setReason(e.target.value)}>
                            {Object.entries(REFUND_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                          <button className="secondary" onClick={() => act(() => api('/refund-requests', { method: 'POST', body: JSON.stringify({ orderItem: i.id, reason }) }), 'İade talebin alındı.')}>İade Talep Et</button>
                        </div>
                      )}
                  </div>
                )
              })}

              {o.status === 'pending_payment' && (
                <div className="row">
                  {process.env.NODE_ENV !== 'production' && (
                    <button onClick={() => act(() => api('/payments/simulate', { method: 'POST', body: JSON.stringify({ orderId: o.id }) }), 'Ödeme simüle edildi.')}>Ödemeyi Tamamla (test)</button>
                  )}
                  <button className="danger" onClick={() => confirm('Sipariş iptal edilsin mi?') && act(() => api(`/orders/${o.id}/cancel`, { method: 'POST' }), 'Sipariş iptal edildi.')}>İptal Et</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}