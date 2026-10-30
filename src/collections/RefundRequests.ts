import type { CollectionConfig, Where } from 'payload'
import { getOwnSellerId } from '../access/sellerScope'
import { eq, sql } from '@payloadcms/db-postgres/drizzle'
import { integerMoney } from '@/utils/money'

export const RefundRequests: CollectionConfig = {
  slug: 'refund-requests',
  labels: { singular: 'Refund Request', plural: 'Refund Requests' },
  admin: { useAsTitle: 'id' },
  access: {
    read: async ({ req }) => {
      if (req.user?.role === 'admin' || req.user?.role === 'support') return true

      if (req.user?.role === 'customer') {
        return { user: { equals: req.user.id } } as Where
      }

      if (req.user?.role === 'seller') {
        const sellerId = await getOwnSellerId(req)
        if (!sellerId) return false

        const items = await req.payload.find({
          collection: 'order-items',
          where: { seller: { equals: sellerId } },
          pagination: false,
          depth: 0,
          overrideAccess: true,
        })

        const itemIds = items.docs.map((i) => String(i.id))
        if (itemIds.length === 0) return false

        return { orderItem: { in: itemIds } } as Where
      }

      return false
    },
    create: ({ req: { user } }) => Boolean(user?.role === 'customer' || user?.role === 'admin'),
    update: ({ req: { user } }) => Boolean(user?.role === 'admin' || user?.role === 'support'),
    delete: ({ req: { user } }) => Boolean(user?.role === 'admin'),
  },
  hooks: {
    beforeValidate: [
      async ({ operation, data, req }) => {
        if (operation !== 'create') return data
        if (!data?.orderItem) throw new Error('orderItem zorunlu.')

        const orderItem = await req.payload.findByID({
          collection: 'order-items',
          id: data.orderItem,
          depth: 0,
          overrideAccess: true,
        })

        if (req.user?.role === 'customer') {
          // Tip koruması: relationship obje de gelse ID de gelse id'yi garantiye alıyoruz
          const orderId = typeof orderItem.order === 'object' ? orderItem.order.id : orderItem.order

          const order = await req.payload.findByID({
            collection: 'orders',
            id: orderId,
            overrideAccess: true,
          })

          const customerId = typeof order.customer === 'object' ? order.customer.id : order.customer
          if (String(customerId) !== String(req.user.id)) {
            throw new Error('Bu sipariş kalemi size ait değil.')
          }
          data.user = req.user.id
        }

        const maxAmount = orderItem.unitPrice * orderItem.quantity
        if (!data.refundAmount || data.refundAmount > maxAmount) {
          data.refundAmount = maxAmount
        }
        data.status = 'pending_review'

        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        if (doc.status !== 'refunded' || previousDoc?.status === 'refunded') return

        const orderItemId = typeof doc.orderItem === 'object' ? doc.orderItem.id : doc.orderItem

        const orderItem = await req.payload.findByID({
          collection: 'order-items',
          id: orderItemId,
          depth: 0,
          overrideAccess: true,
        })

        // 1) Stok iadesi + denetim izi — tek transaction içinde atomik (Drizzle; kolon adlarını Payload çözer).
        const db = (req.payload.db as any).drizzle
        const t = (req.payload.db as any).tables
        const now = () => new Date().toISOString()
        await db.transaction(async (tx: any) => {
          const [updated] = await tx
            .update(t.product_variants)
            .set({ stock: sql`${t.product_variants.stock} + ${orderItem.quantity}`, updatedAt: now() })
            .where(eq(t.product_variants.id, orderItem.variant))
            .returning({ stock: t.product_variants.stock })

          await tx.insert(t.inventory_logs).values({
            variant: orderItem.variant,
            change: orderItem.quantity,
            newStock: updated.stock,
            reason: 'return_accepted',
            referenceId: String(orderItem.order),
            createdAt: now(),
            updatedAt: now(),
          })
        })

        // 2) Kalemi "refunded" yap — sellerPayout rakamı ASLA silinmez/değiştirilmez
        //    (tarihi kayıt), ama itemStatus='refunded' olduğu için gelecekteki
        //    satıcı ödeme raporları bu satırı otomatik hariç tutacak.
        await req.payload.update({
          collection: 'order-items',
          id: orderItem.id,
          data: { itemStatus: 'refunded' },
          overrideAccess: true,
        })


          // 3) Siparişin TÜM kalemleri iade/iptal olduysa ödemeyi de "refunded" say.
        const siblings = await req.payload.find({
          collection: 'order-items',
          where: { order: { equals: orderItem.order } },
          pagination: false,
          depth: 0,
          overrideAccess: true,
        })

        const allSettled = siblings.docs.every((i: any) =>
          ['refunded', 'cancelled'].includes(i.itemStatus),
        )

        if (allSettled) {
          const payments = await req.payload.find({
            collection: 'payments',
            where: { order: { equals: orderItem.order } },
            limit: 1,
            overrideAccess: true,
          })

          if (payments.docs[0]) {
            await req.payload.update({
              collection: 'payments',
              id: payments.docs[0].id,
              data: { status: 'refunded' },
              overrideAccess: true,
            })
          }
        }
      },
    ],
  },
  fields: [
    { name: 'orderItem', type: 'relationship', relationTo: 'order-items', required: true, index: true },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      access: { update: () => false },
    },
    {
      name: 'reason',
      type: 'select',
      required: true,
      options: [
        { label: 'Hasarlı Ürün', value: 'damaged_product' },
        { label: 'Yanlış Ürün', value: 'wrong_item' },
        { label: 'Beden/Ürün Değişimi', value: 'size_exchange' },
        { label: 'Açıklamaya Uygun Değil', value: 'not_as_described' },
      ],
    },
    { name: 'refundAmount', type: 'number', required: true, access: { update: () => false }, validate: integerMoney,  },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending_review',
      index: true,
      options: [
        { label: 'İnceleniyor', value: 'pending_review' },
        { label: 'Onaylandı', value: 'approved' },
        { label: 'Reddedildi', value: 'rejected' },
        { label: 'İade Edildi', value: 'refunded' },
      ],
    },
  ],
}