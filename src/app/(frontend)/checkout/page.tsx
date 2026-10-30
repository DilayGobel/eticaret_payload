'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/Providers'
import { useCart } from '@/components/useCart'
import { api, notifyCartChanged } from '@/lib/api'
import { formatTRY } from '@/lib/money'
import { calcShipping } from '@/utils/coupon'

const emptyAddr = { title: '', fullName: '', phone: '', city: '', district: '', addressLine: '', postalCode: '' }

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth()
  const { items, loading, subtotal } = useCart()
  const router = useRouter()

  const [addresses, setAddresses] = useState<any[]>([])
  const [addressId, setAddressId] = useState('')
  const [newAddr, setNewAddr] = useState(emptyAddr)
  const [showForm, setShowForm] = useState(false)
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<{ code: string; discountAmount: number } | null>(null)
  const [provider, setProvider] = useState('bank_transfer')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadAddresses = async () => {
    const res = await api('/addresses?limit=50&depth=0')
    setAddresses(res.docs)
    setShowForm(res.docs.length === 0)
    if (res.docs[0]) setAddressId((cur) => cur || res.docs[0].id)
  }
  useEffect(() => { if (user) loadAddresses() }, [user])

  // Sepet değişirse kupon indirimi yeniden hesaplanmalı
  useEffect(() => { setCoupon(null) }, [subtotal])

  if (authLoading || loading) return <p className="muted">Yükleniyor…</p>
  if (!user) return <div className="panel stack"><p>Ödeme için giriş yapmalısın.</p><Link className="btn" href="/login">Giriş Yap</Link></div>
  if (items.length === 0) return <div className="panel"><p>Sepetin boş.</p><Link href="/">Alışverişe dön</Link></div>

  const discount = coupon?.discountAmount ?? 0
  const shipping = calcShipping(subtotal - discount)
  const total = subtotal - discount + shipping

  const saveAddress = async () => {
    setError('')
    try {
      const res = await api('/addresses', { method: 'POST', body: JSON.stringify({ ...newAddr, type: 'both' }) })
      setNewAddr(emptyAddr)
      setAddressId(res.doc.id)
      await loadAddresses()
      setShowForm(false)
    } catch (e: any) { setError(e.message) }
  }

  const applyCoupon = async () => {
    setError('')
    try {
      const res = await api('/coupons/validate', { method: 'POST', body: JSON.stringify({ code: couponInput, subtotal }) })
      setCoupon({ code: res.code, discountAmount: res.discountAmount })
    } catch (e: any) { setCoupon(null); setError(e.message) }
  }

  const placeOrder = async () => {
    setBusy(true); setError('')
    try {
      await api('/orders/place-from-cart', {
        method: 'POST',
        body: JSON.stringify({ addressId, couponCode: coupon?.code, paymentProvider: provider }),
      })
      notifyCartChanged()
      router.push('/orders')
    } catch (e: any) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="two" style={{ gridTemplateColumns: '2fr 1fr' }}>
      <div className="stack">
        <h1>Ödeme</h1>
        <div className="panel stack">
          <h3 style={{ margin: 0 }}>Teslimat Adresi</h3>
          {addresses.map((a) => (
            <label key={a.id} className="row">
              <input type="radio" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
              <span><strong>{a.title}</strong> — {a.fullName}, {a.addressLine}, {a.district}/{a.city}</span>
            </label>
          ))}
          {!showForm && <button className="secondary" onClick={() => setShowForm(true)}>+ Yeni adres</button>}
          {showForm && (
            <div className="stack">
              {(['title', 'fullName', 'phone', 'city', 'district', 'postalCode'] as const).map((k) => (
                <input key={k} placeholder={{ title: 'Adres başlığı (Ev, İş)', fullName: 'Ad Soyad', phone: 'Telefon', city: 'İl', district: 'İlçe', postalCode: 'Posta kodu' }[k]}
                  value={newAddr[k]} onChange={(e) => setNewAddr({ ...newAddr, [k]: e.target.value })} />
              ))}
              <textarea placeholder="Açık adres" value={newAddr.addressLine} onChange={(e) => setNewAddr({ ...newAddr, addressLine: e.target.value })} />
              <button onClick={saveAddress}>Adresi Kaydet</button>
            </div>
          )}
        </div>

        <div className="panel stack">
          <h3 style={{ margin: 0 }}>Ödeme Yöntemi</h3>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="bank_transfer">Havale / EFT</option>
            <option value="iyzico">iyzico</option>
            <option value="paytr">PayTR</option>
            <option value="stripe">Stripe</option>
          </select>
        </div>
      </div>

      <div className="panel stack" style={{ alignSelf: 'start' }}>
        <h3 style={{ margin: 0 }}>Sipariş Özeti</h3>
        {items.map((i) => (
          <div key={i.id} className="row between muted"><span>{i.variant.product.name} × {i.quantity}</span><span>{formatTRY(i.variant.price * i.quantity)}</span></div>
        ))}
        <div className="row">
          <input placeholder="Kupon kodu" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
          <button className="secondary" onClick={applyCoupon} disabled={!couponInput}>Uygula</button>
        </div>
        <div className="row between"><span>Ara toplam</span><span>{formatTRY(subtotal)}</span></div>
        {discount > 0 && <div className="row between success"><span>İndirim ({coupon?.code})</span><span>-{formatTRY(discount)}</span></div>}
        <div className="row between"><span>Kargo</span><span>{shipping === 0 ? 'Ücretsiz' : formatTRY(shipping)}</span></div>
        <div className="row between"><strong>Toplam</strong><strong>{formatTRY(total)}</strong></div>
        {error && <div className="error">{error}</div>}
        <button onClick={placeOrder} disabled={busy || !addressId}>Siparişi Onayla</button>
        <div className="muted">Kesin tutar sunucuda yeniden hesaplanır.</div>
      </div>
    </div>
  )
}