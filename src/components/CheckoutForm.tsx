'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCartItems } from '@/lib/cart-client'
import { formatPrice } from '@/lib/format'
import { calcShipping } from '@/lib/shipping'

export default function CheckoutForm() {
  const router = useRouter()
  const [items, setItems] = useState<any[] | null>(null)
  const [addresses, setAddresses] = useState<any[]>([])
  const [addressId, setAddressId] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [provider, setProvider] = useState('bank_transfer')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadAddresses(selectId?: string) {
    const res = await fetch('/api/addresses?limit=50&depth=0', { credentials: 'same-origin' })
    const data = await res.json()
    const docs = data.docs ?? []
    setAddresses(docs)
    setAddressId(selectId ?? docs[0]?.id ?? '')
    setShowNew(docs.length === 0)
  }

  useEffect(() => {
    getCartItems().then(setItems).catch(() => setItems([]))
    loadAddresses()
  }, [])

  async function saveAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const f = new FormData(e.currentTarget)
    const res = await fetch('/api/addresses', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: f.get('title'),
        fullName: f.get('fullName'),
        phone: f.get('phone'),
        city: f.get('city'),
        district: f.get('district'),
        addressLine: f.get('addressLine'),
        postalCode: f.get('postalCode') || undefined,
        type: 'both',
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setError(data?.errors?.[0]?.message || 'Adres kaydedilemedi.')
      return
    }
    await loadAddresses(data.doc.id)
    setShowNew(false)
  }

  async function placeOrder() {
    setError('')
    setLoading(true)
    const res = await fetch('/api/orders/place-from-cart', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addressId,
        couponCode: couponCode.trim() || undefined,
        paymentProvider: provider,
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setError(data?.error || 'Sipariş oluşturulamadı.')
      setLoading(false)
      return
    }
    router.push(`/checkout/success?no=${data.orderNumber}&amount=${data.finalAmount}`)
    router.refresh()
  }

  if (items === null) return <p className="text-gray-500">Yükleniyor...</p>

  if (items.length === 0) {
    return (
      <p className="text-gray-500">
        Sepetin boş. <Link href="/" className="underline">Alışverişe başla</Link>
      </p>
    )
  }

  const subtotal = items.reduce((s, it) => s + (it.variant?.price ?? 0) * it.quantity, 0)
  const shipping = calcShipping(subtotal)

  return (
    <div className="grid gap-8 md:grid-cols-3">
      <div className="space-y-6 md:col-span-2">
        <section className="rounded border bg-white p-4">
          <h2 className="mb-3 font-semibold">Teslimat Adresi</h2>

          {addresses.map((a) => (
            <label key={a.id} className="mb-2 flex cursor-pointer gap-2 rounded border p-3 text-sm">
              <input type="radio" name="address" checked={addressId === a.id}
                onChange={() => setAddressId(a.id)} />
              <span>
                <strong>{a.title}</strong> - {a.fullName}, {a.phone}
                <br />
                {a.addressLine}, {a.district}/{a.city}
              </span>
            </label>
          ))}

          {!showNew && (
            <button onClick={() => setShowNew(true)} className="text-sm underline">
              + Yeni adres ekle
            </button>
          )}

          {showNew && (
            <form onSubmit={saveAddress} className="mt-3 space-y-2">
              <input name="title" required placeholder='Adres başlığı (örn. "Ev")' className="w-full rounded border px-3 py-2" />
              <input name="fullName" required placeholder="Ad Soyad" className="w-full rounded border px-3 py-2" />
              <input name="phone" required placeholder="Telefon" className="w-full rounded border px-3 py-2" />
              <div className="flex gap-2">
                <input name="city" required placeholder="İl" className="w-1/2 rounded border px-3 py-2" />
                <input name="district" required placeholder="İlçe" className="w-1/2 rounded border px-3 py-2" />
              </div>
              <textarea name="addressLine" required placeholder="Açık adres" className="w-full rounded border px-3 py-2" />
              <input name="postalCode" placeholder="Posta kodu (opsiyonel)" className="w-full rounded border px-3 py-2" />
              <button className="rounded bg-black px-4 py-2 text-sm text-white">Adresi Kaydet</button>
            </form>
          )}
        </section>

        <section className="rounded border bg-white p-4">
          <h2 className="mb-3 font-semibold">Ödeme Yöntemi</h2>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}
            className="w-full rounded border px-3 py-2">
            <option value="bank_transfer">Havale/EFT</option>
            <option value="iyzico">iyzico (simülasyon)</option>
            <option value="stripe">Stripe (simülasyon)</option>
            <option value="paytr">PayTR (simülasyon)</option>
          </select>
          <p className="mt-2 text-xs text-gray-500">
            Henüz gerçek ödeme entegrasyonu yok. Ödeme onayı yönetim panelinden verilir.
          </p>
        </section>

        <section className="rounded border bg-white p-4">
          <h2 className="mb-3 font-semibold">Kupon Kodu</h2>
          <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Varsa kupon kodunuz" className="w-full rounded border px-3 py-2" />
          <p className="mt-2 text-xs text-gray-500">İndirim sipariş oluşturulurken uygulanır.</p>
        </section>
      </div>

      <aside className="h-fit space-y-2 rounded border bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">Sipariş Özeti</h2>
        {items.map((it) => (
          <div key={it.id} className="flex justify-between">
            <span className="truncate pr-2">{it.variant?.product?.name} x{it.quantity}</span>
            <span>{formatPrice((it.variant?.price ?? 0) * it.quantity)}</span>
          </div>
        ))}
        <hr />
        <div className="flex justify-between"><span>Ara toplam</span><span>{formatPrice(subtotal)}</span></div>
        <div className="flex justify-between">
          <span>Kargo</span><span>{shipping === 0 ? 'Ücretsiz' : formatPrice(shipping)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <span>Toplam</span><span>{formatPrice(subtotal + shipping)}</span>
        </div>
        <p className="text-xs text-gray-500">Kupon indirimi varsa son tutar siparişte hesaplanır.</p>

        {error && <p className="text-red-600">{error}</p>}
        <button onClick={placeOrder} disabled={loading || !addressId}
          className="w-full rounded bg-black py-2 text-white disabled:opacity-50">
          {loading ? 'Sipariş oluşturuluyor...' : 'Siparişi Onayla'}
        </button>
      </aside>
    </div>
  )
}