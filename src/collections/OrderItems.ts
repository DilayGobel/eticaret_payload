import type { CollectionConfig, Where } from 'payload'
import { getOwnOrderIds } from '../access/orderScope'
import { getOwnSellerId } from '../access/sellerScope'
import { integerMoney } from '../utils/money'

const frozen = { update: () => false } // immutable snapshot: sipariş anında dondu, kimse değiştiremez

export const OrderItems: CollectionConfig = {
  slug: 'order-items',
  labels: { singular: 'Order Item', plural: 'Order Items' },
  admin: { useAsTitle: 'id' },
  access: {
    read: async ({ req }): Promise<boolean | Where> => {
      if (req.user?.role === 'admin' || req.user?.role === 'support') return true
      if (req.user?.role === 'seller') {
        const sellerId = await getOwnSellerId(req)
        if (!sellerId) return false
        return { seller: { equals: sellerId } }
      }
      if (req.user?.role === 'customer') {
        const orderIds = await getOwnOrderIds(req)
        if (orderIds.length === 0) return false
        return { order: { in: orderIds } }
      }
      return false
    },
    create: () => false, // sadece place-from-cart endpoint'i (ham SQL ile) yazar
    update: async ({ req }) => {
      // Satıcı burada sadece itemStatus'u değiştirebilir; diğer alanlar
      // field-level "frozen" access ile zaten herkese kapalı.
      if (req.user?.role === 'admin') return true
      if (req.user?.role === 'seller') {
        const sellerId = await getOwnSellerId(req)
        if (!sellerId) return false
        return { seller: { equals: sellerId } }
      }
      return false
    },
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true },
    { name: 'seller', type: 'relationship', relationTo: 'sellers', required: true, index: true },
    { name: 'variant', type: 'relationship', relationTo: 'product-variants', required: true, index: true },
    { name: 'quantity', type: 'number', required: true, access: frozen },
    { name: 'unitPrice', type: 'number', required: true, access: frozen, validate: integerMoney, },
    { name: 'commissionRate', type: 'number', required: true, access: frozen },
    { name: 'sellerPayout', type: 'number', required: true, access: frozen, validate: integerMoney,  },
    {
      name: 'itemStatus',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Bekliyor', value: 'pending' },
        { label: 'Hazırlanıyor', value: 'preparing' },
        { label: 'Kargolandı', value: 'shipped' },
        { label: 'Teslim Edildi', value: 'delivered' },
        { label: 'İptal Edildi', value: 'cancelled' },
        { label: 'İade Edildi', value: 'refunded' },
      ],
    },
  ],
}