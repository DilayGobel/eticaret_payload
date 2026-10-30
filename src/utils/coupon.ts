// src/utils/coupon.ts
// Kupon + kargo hesapları. Tüm tutarlar kuruş (integer).
// Hem /orders/place-from-cart hem /coupons/validate bu fonksiyonları kullanır,
// böylece "önizleme" ile "gerçek sipariş" asla farklı sonuç vermez.

export const SHIPPING_FLAT = 4990 // 49,90 TL
export const FREE_SHIPPING_THRESHOLD = 50000 // 500 TL ve üstü ücretsiz

export function calcDiscount(coupon: any, subtotal: number): number {
  if (!coupon || !coupon.isActive) throw new Error('Kupon geçersiz.')
  if (coupon.usageLimit && (coupon.usageCount || 0) >= coupon.usageLimit) {
    throw new Error('Kupon kullanım limiti doldu.')
  }
  if (subtotal < (coupon.minCart || 0)) {
    throw new Error(`Bu kupon için minimum sepet tutarı ${coupon.minCart} kuruş.`)
  }
  const value = Number(coupon.discountValue || 0)
  if (coupon.discountType === 'percentage') {
    return Math.round((subtotal * Math.min(Math.max(value, 0), 100)) / 100)
  }
  return Math.min(Math.max(value, 0), subtotal)
}

export function calcShipping(subtotalAfterDiscount: number): number {
  return subtotalAfterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT
}