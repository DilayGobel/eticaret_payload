import type { CollectionConfig, Where } from 'payload'
import { getOwnOrderIds } from '../access/orderScope'
import { integerMoney } from '../utils/money'

export const Payments: CollectionConfig = {
  slug: 'payments',
  admin: {
    useAsTitle: 'transactionId',
    hidden: ({ user }) => user?.role === 'seller' || user?.role === 'support',
  },
  access: {
    read: async ({ req }) => {
      if (req.user?.role === 'admin') return true
      if (req.user?.role === 'customer') {
        const orderIds = await getOwnOrderIds(req)
        if (orderIds.length === 0) return false
        return { order: { in: orderIds } } as Where
      }
      return false
    },
    create: () => false,
    update: ({ req: { user } }) => Boolean(user?.role === 'admin'),
    delete: () => false,
  },
  endpoints: [
    // GELİŞTİRME: gerçek sağlayıcı (iyzico/PayTR) webhook'unun yerine geçer. Production'da kapalıdır.
    // Body: { orderId: string, success?: boolean }
    {
      path: '/simulate',
      method: 'post',
      handler: async (req) => {
        if (process.env.NODE_ENV === 'production') {
          return Response.json({ error: 'Bulunamadı.' }, { status: 404 })
        }
        if (!req.user) return Response.json({ error: 'Giriş yapmalısınız.' }, { status: 401 })

        const body = (typeof req.json === 'function' ? await req.json().catch(() => ({})) : req.data) as any
        const orderId = body?.orderId ? String(body.orderId) : ''
        if (!orderId) return Response.json({ error: 'orderId zorunlu.' }, { status: 400 })

        const order = await req.payload
          .findByID({ collection: 'orders', id: orderId, depth: 0, overrideAccess: true })
          .catch(() => null)
        const customerId = order && (typeof order.customer === 'object' ? (order.customer as any).id : order.customer)
        if (!order || (req.user.role !== 'admin' && String(customerId) !== String(req.user.id))) {
          return Response.json({ error: 'Sipariş bulunamadı.' }, { status: 404 })
        }
        if (order.status !== 'pending_payment') {
          return Response.json({ error: 'Bu sipariş ödeme beklemiyor.' }, { status: 400 })
        }

        const payments = await req.payload.find({
          collection: 'payments',
          where: { order: { equals: orderId } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const payment = payments.docs[0]
        if (!payment || payment.status !== 'pending') {
          return Response.json({ error: 'Bekleyen ödeme kaydı yok.' }, { status: 400 })
        }

        const success = body?.success !== false
        // status 'success' olunca aşağıdaki afterChange hook'u siparişi "paid" yapar + satıcı başına kargo açar.
        await req.payload.update({
          collection: 'payments',
          id: payment.id,
          data: { status: success ? 'success' : 'failed', transactionId: `SIM-${Date.now()}` },
          overrideAccess: true,
        })
        return Response.json({ ok: true, status: success ? 'success' : 'failed' })
      },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        if (doc.status === 'success' && previousDoc?.status !== 'success') {
          const orderId = typeof doc.order === 'object' ? doc.order.id : doc.order

          await req.payload.update({
            collection: 'orders',
            id: orderId,
            data: { status: 'paid' },
            overrideAccess: true,
          })

          // Split-Order: siparişteki her farklı satıcı için bağımsız kargo paketi.
          const items = await req.payload.find({
            collection: 'order-items',
            where: { order: { equals: orderId } },
            pagination: false,
            depth: 0,
            overrideAccess: true,
          })

          const sellerIds = [
            ...new Set(items.docs.map((i: any) => (typeof i.seller === 'object' ? i.seller.id : i.seller))),
          ]

          for (const sellerId of sellerIds) {
            const existing = await req.payload.find({
              collection: 'shipments' as any,
              where: { and: [{ order: { equals: orderId } }, { seller: { equals: sellerId } }] },
              limit: 1,
              overrideAccess: true,
            })
            if (!existing.docs[0]) {
              await req.payload.create({
                collection: 'shipments' as any,
                data: { order: orderId, seller: sellerId, status: 'label_created' },
                overrideAccess: true,
              })
            }
          }
        }
      },
    ],
  },
  fields: [
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, unique: true, index: true },
    {
      name: 'provider',
      type: 'select',
      required: true,
      options: [
        { label: 'iyzico', value: 'iyzico' },
        { label: 'Stripe', value: 'stripe' },
        { label: 'PayTR', value: 'paytr' },
        { label: 'Havale/EFT', value: 'bank_transfer' },
      ],
    },
    { name: 'transactionId', type: 'text', unique: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Bekliyor', value: 'pending' },
        { label: 'Başarılı', value: 'success' },
        { label: 'Başarısız', value: 'failed' },
        { label: 'İade Edildi', value: 'refunded' },
      ],
    },
    { name: 'amount', type: 'number', required: true, validate: integerMoney,  },
  ],
}