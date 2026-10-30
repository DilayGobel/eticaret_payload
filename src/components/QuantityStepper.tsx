// src/components/QuantityStepper.tsx
'use client'

// [−] 2 [+] kontrolü. Adet 1'deyken [−] ürünü sepetten siler (çöp kutusu ikonu görünür).
export function QuantityStepper({
  value, max, onChange, onRemove,
}: { value: number; max: number; onChange: (n: number) => void; onRemove: () => void }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      <button type="button" className="secondary" style={{ padding: '6px 12px' }}
        onClick={() => (value <= 1 ? onRemove() : onChange(value - 1))}>
        {value <= 1 ? '🗑' : '−'}
      </button>
      <strong style={{ minWidth: 28, textAlign: 'center' }}>{value}</strong>
      <button type="button" className="secondary" style={{ padding: '6px 12px' }}
        disabled={value >= max} title={value >= max ? `Stokta en fazla ${max} adet var` : ''}
        onClick={() => onChange(value + 1)}>+</button>
      {value >= max && <span className="muted">Stok sınırı ({max})</span>}
    </div>
  )
}