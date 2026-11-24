'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatTRY } from '@/lib/money'
import { useCart } from '@/components/useCart'
import type { CardImg, CardVariant } from '@/components/ProductCard'

const KEY_LABELS: Record<string, string> = {
  renk: 'Renk',
  switch: 'Switch',
  baglanti: 'Bağlantı',
  beden: 'Beden',
  boyut: 'Boyut',
}

function parseValues(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((x) => String(x).split(',')).map((x) => x.trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  }
  return []
}

const norm = (s: string) =>
  s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim()

const hasWholeWord = (haystack: string, needle: string) => {
  if (!haystack || !needle) return false
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack)
}

export function QuickAddModal({
  open,
  onClose,
  productName,
  images,
  variants,
  initialColor,
}: {
  open: boolean
  onClose: () => void
  productName: string
  images: CardImg[]
  variants: CardVariant[]
  initialColor?: string
}) {
  const { qty, change } = useCart()
  const [addCount, setAddCount] = useState(1)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [resolvedIds, setResolvedIds] = useState<Record<string, string>>({})

  const axes = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const v of variants) {
      if (!v.options) continue
      for (const [k, rawVal] of Object.entries(v.options)) {
        const vals = parseValues(rawVal)
        if (!vals.length) continue
        if (!map[k]) map[k] = []
        for (const val of vals) {
          if (!map[k].includes(val)) map[k].push(val)
        }
      }
    }
    return map
  }, [variants])

  const axisKeys = Object.keys(axes)
  const colorAxisKey = axisKeys.find((k) => norm(k) === 'renk' || norm(k) === 'color')
  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0]

  const [selectedOpts, setSelectedOpts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setMsg(null)
    setAddCount(1)

    const next: Record<string, string> = {}
    for (const k of Object.keys(axes)) {
      if (k === colorAxisKey && initialColor && axes[k].includes(initialColor)) {
        next[k] = initialColor
      } else {
        next[k] = axes[k][0]
      }
    }
    setSelectedOpts(next)
  }, [open, axes, colorAxisKey, initialColor])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  const colorToImageIdx = useMemo(() => {
    const result: Record<string, number> = {}
    if (!colorAxisKey || !images.length) return result

    const colors = axes[colorAxisKey] || []
    const normProduct = norm(productName || '')
    const usedImgIndices = new Set<number>()

    const colorsBySpecificity = [...colors].sort(
      (a, b) => norm(b.split(',')[0]).length - norm(a.split(',')[0]).length,
    )

    for (const color of colorsBySpecificity) {
      const target = norm(color.split(',')[0])
      if (!target) continue
      const idx = images.findIndex((img, i) => {
        if (usedImgIndices.has(i)) return false
        const alt = String(img.alt || '')
        const altNorm = norm(alt)
        const suffixNorm = alt.includes(' - ') ? norm(alt.split(' - ').pop() || '') : ''
        return altNorm === target || suffixNorm === target
      })
      if (idx !== -1) {
        result[color] = idx
        usedImgIndices.add(idx)
      }
    }

    for (const color of colorsBySpecificity) {
      if (result[color] !== undefined) continue
      const target = norm(color.split(',')[0])
      if (!target) continue
      const idx = images.findIndex((img, i) => {
        if (usedImgIndices.has(i)) return false
        const altNorm = norm(img.alt || '')
        const fileBase = norm(String(img.filename || '').replace(/\.[^.]+$/, ''))
        return hasWholeWord(altNorm, target) || hasWholeWord(fileBase, target)
      })
      if (idx !== -1) {
        result[color] = idx
        usedImgIndices.add(idx)
      }
    }

    for (const color of colorsBySpecificity) {
      if (result[color] !== undefined) continue
      const target = norm(color.split(',')[0])
      if (!target) continue
      const idx = images.findIndex((img, i) => {
        if (usedImgIndices.has(i)) return false
        const altNorm = norm(img.alt || '')
        const altClean = normProduct ? altNorm.replace(normProduct, '').trim() : altNorm
        const fileBase = norm(String(img.filename || '').replace(/\.[^.]+$/, ''))
        return altClean.includes(target) || fileBase.includes(target)
      })
      if (idx !== -1) {
        result[color] = idx
        usedImgIndices.add(idx)
      }
    }

    colors.forEach((color, colorIdx) => {
      if (result[color] !== undefined) return
      if (images[colorIdx] && !usedImgIndices.has(colorIdx)) {
        result[color] = colorIdx
        usedImgIndices.add(colorIdx)
        return
      }
      const firstUnused = images.findIndex((_, i) => !usedImgIndices.has(i))
      if (firstUnused !== -1) {
        result[color] = firstUnused
        usedImgIndices.add(firstUnused)
      } else if (images[colorIdx]) {
        result[color] = colorIdx
      }
    })

    return result
  }, [axes, colorAxisKey, images, productName])

  if (!open || typeof document === 'undefined') return null

  const variantMatchesOption = (v: CardVariant, key: string, val: string) => {
    if (!v.options) return false
    return parseValues(v.options[key]).includes(val)
  }

  const exactVariant = variants.find(
    (v) =>
      v.options &&
      axisKeys.length > 0 &&
      axisKeys.every((k) => String(v.options?.[k] || '').trim() === selectedOpts[k]),
  )

  const sel =
    exactVariant ??
    (axisKeys.length === 0
      ? firstInStock
      : variants.find(
          (v) =>
            v.options &&
            axisKeys.every((k) => variantMatchesOption(v, k, selectedOpts[k])),
        ) ?? firstInStock)

  const comboKey = JSON.stringify(selectedOpts)
  const effectiveVariantId = exactVariant?.id ?? resolvedIds[comboKey] ?? sel?.id

  const inCartQty =
    exactVariant || resolvedIds[comboKey] || axisKeys.length === 0
      ? qty[String(effectiveVariantId)] || 0
      : 0

  const maxAddable = sel ? Math.max(0, sel.stock - inCartQty) : 0
  const safeCount = Math.max(1, Math.min(addCount, Math.max(1, maxAddable)))

  const isOptionAvailable = (key: string, value: string) => {
    return variants.some(
      (v) =>
        v.stock > 0 &&
        variantMatchesOption(v, key, value) &&
        axisKeys.every((k) => k === key || !selectedOpts[k] || variantMatchesOption(v, k, selectedOpts[k])),
    )
  }

  const activeImgIdx =
    colorAxisKey && selectedOpts[colorAxisKey] && colorToImageIdx[selectedOpts[colorAxisKey]] !== undefined
      ? colorToImageIdx[selectedOpts[colorAxisKey]]
      : 0
  const activeImg = images[activeImgIdx] ?? images[0]

  const handleConfirm = async () => {
    if (!sel || busy || maxAddable <= 0) return
    setBusy(true)
    setMsg(null)
    try {
      const targetId = String(exactVariant?.id ?? resolvedIds[comboKey] ?? sel.id)
      const res = await change(targetId, safeCount, axisKeys.length > 0 ? selectedOpts : undefined)
      if (res?.variantId) {
        setResolvedIds((prev) => ({ ...prev, [comboKey]: String(res.variantId) }))
      }
      setMsg({ ok: true, text: 'Sepete eklendi!' })
      setTimeout(() => {
        onClose()
      }, 600)
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Sepete eklenemedi' })
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: 14,
          padding: 20,
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Üst Bilgi */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {activeImg?.url ? (
            <img
              src={activeImg.url}
              alt={activeImg.alt || productName}
              style={{
                width: 72,
                height: 72,
                objectFit: 'contain',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 4,
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 10,
                background: '#f1f5f9',
                flexShrink: 0,
              }}
            />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>{productName}</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#ea580c', marginTop: 4 }}>
              {sel ? formatTRY(sel.price) : '—'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {!sel
                ? 'Bu kombinasyon mevcut değil'
                : sel.stock > 0
                  ? sel.stock <= 5
                    ? `Son ${sel.stock} adet`
                    : 'Stokta var'
                  : 'Tükendi'}
              {inCartQty > 0 && ` • Sepette ${inCartQty} adet`}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#475569',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 600,
              alignSelf: 'flex-start',
            }}
          >
            ✕
          </button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />

        {/* Seçenek Grupları */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {axisKeys.map((key) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b' }}>
                {KEY_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1)}:{' '}
                <strong style={{ color: '#0f172a' }}>{selectedOpts[key]}</strong>
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {axes[key].map((val) => {
                  const isSelected = selectedOpts[key] === val
                  const available = isOptionAvailable(key, val)
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setMsg(null)
                        setAddCount(1)
                        setSelectedOpts((prev) => ({ ...prev, [key]: val }))
                      }}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 8,
                        border: isSelected ? '2px solid #ea580c' : '1px solid #cbd5e1',
                        background: isSelected ? '#fff7ed' : '#ffffff',
                        color: isSelected ? '#ea580c' : '#1e293b',
                        fontWeight: isSelected ? 600 : 400,
                        fontSize: 13,
                        cursor: available ? 'pointer' : 'not-allowed',
                        opacity: available ? 1 : 0.45,
                      }}
                    >
                      {val}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {msg && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: msg.ok ? '#ecfdf5' : '#fef2f2',
              color: msg.ok ? '#059669' : '#dc2626',
            }}
          >
            {msg.text}
          </div>
        )}

        {/* Alt Aksiyon Alanı */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
          {maxAddable > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '4px 8px',
                background: '#f8fafc',
              }}
            >
              <button
                type="button"
                onClick={() => setAddCount((c) => Math.max(1, c - 1))}
                disabled={safeCount <= 1}
                style={{
                  width: 26,
                  height: 26,
                  border: 'none',
                  background: 'transparent',
                  color: '#0f172a',
                  fontWeight: 'bold',
                  fontSize: 16,
                  cursor: safeCount <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                −
              </button>
              <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 600, fontSize: 14 }}>
                {safeCount}
              </span>
              <button
                type="button"
                onClick={() => setAddCount((c) => Math.min(maxAddable, c + 1))}
                disabled={safeCount >= maxAddable}
                style={{
                  width: 26,
                  height: 26,
                  border: 'none',
                  background: 'transparent',
                  color: '#0f172a',
                  fontWeight: 'bold',
                  fontSize: 16,
                  cursor: safeCount >= maxAddable ? 'not-allowed' : 'pointer',
                }}
              >
                +
              </button>
            </div>
          )}

          <button
            type="button"
            className="btn"
            onClick={handleConfirm}
            disabled={!sel || busy || maxAddable <= 0}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: !sel || busy || maxAddable <= 0 ? 'not-allowed' : 'pointer',
              opacity: !sel || maxAddable <= 0 ? 0.55 : 1,
            }}
          >
            {!sel || sel.stock <= 0
              ? 'Tükendi'
              : maxAddable <= 0
                ? 'Maksimum Stok Sepette'
                : busy
                  ? 'Ekleniyor...'
                  : '+ Sepete Ekle'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}