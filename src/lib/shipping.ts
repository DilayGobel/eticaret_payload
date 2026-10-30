export const SHIPPING_FEE = 5000 // 50,00 TL (kuruş)
export const FREE_SHIPPING_OVER = 100000 // 1.000,00 TL ve üzeri ücretsiz

export const calcShipping = (amount: number) => (amount >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE)