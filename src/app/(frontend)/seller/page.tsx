// src/app/(frontend)/seller/page.tsx
'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSeller } from '@/components/SellerGate'
import { api } from '@/lib/api'

export default function SellerDashboard() {
  const seller = useSeller()
  const [stats, setStats] = useState({ products: 0, toShip: 0, inTransit: 0 })

  useEffect(() => {
    Promise.all([
      api(`/products?where[seller][equals]=${seller.id}&limit=1&depth=0`),
      api(`/shipments?where[seller][equals]=${seller.id}&where[status][equals]=label_created&limit=1&depth=0`),
      api(`/shipments?where[seller][equals]=${seller.id}&where[status][equals]=in_transit&limit=1&depth=0`),
    ]).then(([p, a, b]) => setStats({ products: p.totalDocs, toShip: a.totalDocs, inTransit: b.totalDocs }))
  }, [seller.id])

  return (
    <>
      <h1>{seller.storeName}</h1>
      <div className="grid" style={{ marginBottom: 24 }}>
        <Link href="/seller/products" className="panel"><div className="muted">Ürünlerim</div><div className="price" style={{ fontSize: 28 }}>{stats.products}</div></Link>
        <Link href="/seller/orders" className="panel"><div className="muted">Kargolanacak</div><div className="price" style={{ fontSize: 28 }}>{stats.toShip}</div></Link>
        <Link href="/seller/orders" className="panel"><div className="muted">Yolda</div><div className="price" style={{ fontSize: 28 }}>{stats.inTransit}</div></Link>
      </div>
      <div className="panel stack">
        <div className="row between"><span className="muted">Komisyon oranı</span><span>%{seller.commissionRate}</span></div>
        <div className="row between"><span className="muted">IBAN</span><span>{seller.payoutIban}</span></div>
        <div className="row between"><span className="muted">Vitrin sayfası</span><span>/{seller.slug}</span></div>
      </div>
    </>
  )
}