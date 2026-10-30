import type { CollectionConfig } from 'payload'
import { randomInt } from 'node:crypto'
import { eq, sql } from '@payloadcms/db-postgres/drizzle'
import { integerMoney } from '../utils/money'
import { calcDiscount, calcShipping } from '../utils/coupon'

const PROVIDERS = ['iyzico', 'stripe', 'paytr', 'bank_transfer']

class HttpError extends Error {
  constructor(message: string, public status = 409) {
    super(message)
  }
}

const readBody = async (req: any) =>
  ((typeof req.json === 'function' ? await req.json().catch(() => ({})) : req.data) || {}) as any

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    hidden: ({ user }) => user?.role === 'seller',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'admin' || user?.role === 'support') return true
      if (user?.role === 'customer') return { customer: { equals: user.id } }
      return false
    },
    create: () => false, // SADECE /api/orders/place-from-cart üzerinden
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'support',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  endpoints: [
    // ───────────────────────── SİPARİŞ VER ─────────────────────────
    {
      path: '/place-from-cart',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Giriş yapmalısınız.' }, { status: 401 })

        const { addressId, shippingAddress: rawAddress, couponCode, paymentProvider } = await readBody(req)

        const provider = paymentProvider || 'bank_transfer'
        if (!PROVIDERS.includes(provider)) {
          return Response.json({ error: 'Geçersiz ödeme yöntemi.' }, { status: 400 })
        }

        // Adres: kayıtlı adres ID'si (önerilen) ya da serbest obje. Her iki durumda da DONDURULMUŞ KOPYA saklanır.
        let shippingAddress: any = rawAddress
        if (addressId) {
          const addr = await req.payload.findByID({
            collection: 'addresses',
            id: String(addressId),
            depth: 0,
            overrideAccess: true,
          }).catch(() => null)
          if (!addr || String((addr as any).user) !== String(req.user.id)) {
            return Response.json({ error: 'Adres bulunamadı.' }, { status: 400 })
          }
          const { id, createdAt, updatedAt, user, ...snapshot } = addr as any
          shippingAddress = snapshot
        }
        if (!shippingAddress || typeof shippingAddress !== 'object') {
          return Response.json({ error: 'Teslimat adresi zorunlu.' }, { status: 400 })
        }

        // Sepeti oku (variant -> product -> seller iç içe)
        const cartsRes = await req.payload.find({
          collection: 'carts',
          where: { user: { equals: req.user.id } },
          limit: 1,
          overrideAccess: true,
        })
        const cart = cartsRes.docs[0]
        if (!cart) return Response.json({ error: 'Sepetiniz boş.' }, { status: 400 })

        const itemsRes = await req.payload.find({
          collection: 'cart-items',
          where: { cart: { equals: cart.id } },
          depth: 3,
          pagination: false,
          overrideAccess: true,
        })
        if (itemsRes.docs.length === 0) return Response.json({ error: 'Sepetiniz boş.' }, { status: 400 })

        // Satın alınabilirlik: ürün yayında + satıcı onaylı olmalı
        for (const item of itemsRes.docs as any[]) {
          const variant = item.variant
          const product = variant?.product
          const seller = product?.seller
          if (!variant || !product || !seller?.id) {
            return Response.json({ error: 'Sepette geçersiz ürün var.' }, { status: 400 })
          }
          if (product.status !== 'published' || seller.status !== 'approved') {
            return Response.json({ error: `"${product.name}" şu an satın alınamıyor.` }, { status: 400 })
          }
        }

        const db = (req.payload.db as any).drizzle
        const t = (req.payload.db as any).tables
        const orderNumber = `ORD-${new Date().getFullYear()}-${randomInt(100000, 999999)}`
        const now = () => new Date().toISOString()

        try {
          const result = await db.transaction(async (tx: any) => {
            // Deadlock olmasın diye varyantları hep aynı sırada kilitle
            const items = [...(itemsRes.docs as any[])].sort((a, b) =>
              String(a.variant.id).localeCompare(String(b.variant.id)),
            )

            let subtotal = 0
            const lines: any[] = []

            for (const item of items) {
              const variant = item.variant
              const seller = variant.product.seller

              // Satır kilidi: fiyat/stok bu noktadan sonra değişemez
              const [row] = await tx
                .select({ price: t.product_variants.price, stock: t.product_variants.stock })
                .from(t.product_variants)
                .where(eq(t.product_variants.id, variant.id))
                .for('update')
              if (!row) throw new HttpError(`Varyant bulunamadı: ${variant.sku}`)
              if (Number(row.stock) < item.quantity) {
                throw new HttpError(`Yetersiz stok: ${variant.sku} (kalan: ${row.stock})`)
              }

              const newStock = Number(row.stock) - item.quantity
              await tx
                .update(t.product_variants)
                .set({ stock: newStock, updatedAt: now() })
                .where(eq(t.product_variants.id, variant.id))

              await tx.insert(t.inventory_logs).values({
                variant: variant.id,
                change: -item.quantity,
                newStock,
                reason: 'order_placed',
                referenceId: orderNumber,
                createdAt: now(),
                updatedAt: now(),
              })

              const unitPrice = Number(row.price) // her zaman DB fiyatı
              const commissionRate = Number(seller.commissionRate)
              const lineTotal = unitPrice * item.quantity
              const commissionAmount = Math.round((lineTotal * commissionRate) / 100)

              subtotal += lineTotal
              lines.push({
                seller: seller.id,
                variant: variant.id,
                quantity: item.quantity,
                unitPrice,
                commissionRate,
                sellerPayout: lineTotal - commissionAmount,
              })
            }

            // Kupon: kilitle, doğrula, sayacı AYNI transaction'da artır (yarış durumu yok)
            let couponId: string | null = null
            let discountAmount = 0
            if (couponCode) {
              const [coupon] = await tx
                .select()
                .from(t.coupons)
                .where(eq(t.coupons.code, String(couponCode).toUpperCase().trim()))
                .for('update')
              try {
                discountAmount = calcDiscount(coupon, subtotal)
              } catch (e: any) {
                throw new HttpError(e.message, 400)
              }
              couponId = coupon.id
              await tx
                .update(t.coupons)
                .set({ usageCount: sql`coalesce(${t.coupons.usageCount}, 0) + 1`, updatedAt: now() })
                .where(eq(t.coupons.id, coupon.id))
            }

            const shippingFee = calcShipping(subtotal - discountAmount) // sunucu hesaplar
            const finalAmount = subtotal - discountAmount + shippingFee

            const [order] = await tx
              .insert(t.orders)
              .values({
                orderNumber,
                customer: req.user!.id,
                coupon: couponId,
                shippingAddress,
                subtotal,
                discountAmount,
                shippingFee,
                finalAmount,
                status: 'pending_payment',
                createdAt: now(),
                updatedAt: now(),
              })
              .returning({ id: t.orders.id })

            // Split-order: kalemler satıcı bazlı
            for (const line of lines) {
              await tx.insert(t.order_items).values({
                order: order.id,
                ...line,
                itemStatus: 'pending',
                createdAt: now(),
                updatedAt: now(),
              })
            }

            await tx.insert(t.payments).values({
              order: order.id,
              provider,
              status: 'pending',
              amount: finalAmount,
              createdAt: now(),
              updatedAt: now(),
            })

            // Sepeti de aynı transaction'da boşalt: ya hep ya hiç
            await tx.delete(t.cart_items).where(eq(t.cart_items.cart, cart.id))
            await tx.delete(t.carts).where(eq(t.carts.id, cart.id))

            return { orderId: order.id, orderNumber, subtotal, discountAmount, shippingFee, finalAmount }
          })

          return Response.json(result)
        } catch (err: any) {
          const status = err instanceof HttpError ? err.status : 500
          if (status === 500) req.payload.logger.error(err)
          return Response.json(
            { error: status === 500 ? 'Sipariş oluşturulamadı.' : err.message },
            { status },
          )
        }
      },
    },

    // ───────────────────────── SİPARİŞ İPTAL ─────────────────────────
    // Sadece ödeme beklenen siparişler iptal edilir (ödenmişler iade akışından geçer).
    {
      path: '/:id/cancel',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Giriş yapmalısınız.' }, { status: 401 })
        const orderId = (req.routeParams as any)?.id as string
        if (!orderId) return Response.json({ error: 'Sipariş ID zorunlu.' }, { status: 400 })

        const db = (req.payload.db as any).drizzle
        const t = (req.payload.db as any).tables
        const now = () => new Date().toISOString()

        try {
          await db.transaction(async (tx: any) => {
            const [order] = await tx
              .select()
              .from(t.orders)
              .where(eq(t.orders.id, orderId))
              .for('update')

            // Başkasının siparişi için "var/yok" bilgisi sızdırma
            if (!order || (req.user!.role !== 'admin' && String(order.customer) !== String(req.user!.id))) {
              throw new HttpError('Sipariş bulunamadı.', 404)
            }
            if (order.status !== 'pending_payment') {
              throw new HttpError('Sadece ödeme bekleyen siparişler iptal edilebilir.', 400)
            }

            const items = (
              await tx.select().from(t.order_items).where(eq(t.order_items.order, orderId))
            ).sort((a: any, b: any) => String(a.variant).localeCompare(String(b.variant)))

            for (const item of items) {
              const [updated] = await tx
                .update(t.product_variants)
                .set({ stock: sql`${t.product_variants.stock} + ${item.quantity}`, updatedAt: now() })
                .where(eq(t.product_variants.id, item.variant))
                .returning({ stock: t.product_variants.stock })

              await tx.insert(t.inventory_logs).values({
                variant: item.variant,
                change: item.quantity,
                newStock: updated.stock,
                reason: 'order_cancelled',
                referenceId: order.orderNumber,
                createdAt: now(),
                updatedAt: now(),
              })
            }

            await tx
              .update(t.order_items)
              .set({ itemStatus: 'cancelled', updatedAt: now() })
              .where(eq(t.order_items.order, orderId))
            await tx
              .update(t.payments)
              .set({ status: 'failed', updatedAt: now() })
              .where(eq(t.payments.order, orderId))
            await tx
              .update(t.orders)
              .set({ status: 'cancelled', updatedAt: now() })
              .where(eq(t.orders.id, orderId))

            if (order.coupon) {
              await tx
                .update(t.coupons)
                .set({ usageCount: sql`greatest(coalesce(${t.coupons.usageCount}, 0) - 1, 0)`, updatedAt: now() })
                .where(eq(t.coupons.id, order.coupon))
            }
          })
          return Response.json({ cancelled: true })
        } catch (err: any) {
          const status = err instanceof HttpError ? err.status : 500
          if (status === 500) req.payload.logger.error(err)
          return Response.json(
            { error: status === 500 ? 'Sipariş iptal edilemedi.' : err.message },
            { status },
          )
        }
      },
    },
  ],
  fields: [
    { name: 'orderNumber', type: 'text', required: true, unique: true, index: true },
    { name: 'customer', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'coupon', type: 'relationship', relationTo: 'coupons' },
    { name: 'shippingAddress', type: 'json', required: true, admin: { description: 'Sipariş anında dondurulmuş adres kopyası.' } },
    { name: 'subtotal', type: 'number', required: true, validate: integerMoney },
    { name: 'discountAmount', type: 'number', defaultValue: 0, validate: integerMoney },
    { name: 'shippingFee', type: 'number', required: true, defaultValue: 0, validate: integerMoney },
    { name: 'finalAmount', type: 'number', required: true, validate: integerMoney },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending_payment',
      index: true,
      options: [
        { label: 'Ödeme Bekleniyor', value: 'pending_payment' },
        { label: 'Ödendi', value: 'paid' },
        { label: 'İptal Edildi', value: 'cancelled' },
        { label: 'Tamamlandı', value: 'completed' },
      ],
    },
  ],
}