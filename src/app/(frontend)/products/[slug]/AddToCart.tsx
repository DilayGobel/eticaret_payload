'use client'
import { useState } from 'react'
import { addToCart } from '@/lib/api'
import { formatTRY } from '@/lib/money'

type V = { id: string; sku: string; price: number; stock: number; options?: Record<string, string> | null }

export function AddToCart({ variants }: { variants: V[] }) {
  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0]
  const [sel, setSel] = useState<V | undefined>(firstInStock)
  const [qty, setQty] = useState(1)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (!sel) return <p className="muted">Bu ürün için seçenek bulunamadı.</p>

  const label = (v: V) => (v.options && Object.values(v.options).join(' / ')) || v.sku

  const add = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await addToCart(sel.id, qty)
      setMsg({ ok: true, text: 'Sepete eklendi.' })
    } catch (e: any) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <div className="price" style={{ fontSize: 26 }}>{formatTRY(sel.price)}</div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {variants.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`opt ${sel.id === v.id ? 'sel' : ''} ${v.stock <= 0 ? 'off' : ''}`}
            style={{ color: 'inherit', fontWeight: 400 }}
            disabled={v.stock <= 0}
            onClick={() => { setSel(v); setQty(1) }}
          >
            {label(v)}
          </button>
        ))}
      </div>
      <div className="muted">{sel.stock > 0 ? (sel.stock <= 5 ? `Son ${sel.stock} adet!` : 'Stokta var') : 'Tükendi'}</div>
      <div className="row">
        <input type="number" min={1} max={Math.max(sel.stock, 1)} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(sel.stock, Number(e.target.value) || 1)))} style={{ width: 80 }} />
        <button onClick={add} disabled={busy || sel.stock <= 0}>Sepete Ekle</button>
      </div>
      {msg && <div className={msg.ok ? 'success' : 'error'}>{msg.text}</div>}
    </div>
  )
}