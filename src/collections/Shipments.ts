// src/collections/Shipments.ts
import type { Access, CollectionConfig, Where } from 'payload'
import { getOwnOrderIds } from '../access/orderScope'
import { getOwnSellerId } from '../access/sellerScope'

const readAccess: Access = async ({ req }) => {
  if (req.user?.role === 'admin' || req.user?.role === 'support') return true

  if (req.user?.role === 'seller') {
    const sellerId = await getOwnSellerId(req)
    if (!sellerId) return false
    
    const query: Where = {
      seller: { equals: sellerId },
    }
    return query
  }

  if (req.user?.role === 'customer') {
    const orderIds = await getOwnOrderIds(req)
    if (!orderIds || orderIds.length === 0) return false
    
    const query: Where = {
      order: { in: orderIds },
    }
    return query
  }

  return false
}

export const Shipments: CollectionConfig = {
  slug: 'shipments',
  admin: { useAsTitle: 'id' },
  access: {
    read: readAccess,
    create: ({ req: { user } }) => Boolean(user?.role === 'admin'),
    update: async ({ req }) => {
      if (req.user?.role === 'admin' || req.user?.role === 'support') return true
      if (req.user?.role === 'seller') {
        const sellerId = await getOwnSellerId(req)
        if (!sellerId) return false
        
        const query: Where = {
          seller: { equals: sellerId },
        }
        return query
      }
      return false
    },
    delete: ({ req: { user } }) => Boolean(user?.role === 'admin'),
  },
  fields: [
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      required: true,
      index: true,
      access: { update: ({ req }) => Boolean(req.user?.role === 'admin') },
    },
    {
      name: 'seller',
      type: 'relationship',
      relationTo: 'sellers',
      required: true,
      index: true,
      access: { update: ({ req }) => Boolean(req.user?.role === 'admin') },
    },
    {
      name: 'orderNumber',
      type: 'text',
      admin: { readOnly: true },
      access: { update: ({ req }) => Boolean(req.user?.role === 'admin') },
    },
    {
      name: 'shippingAddress',
      type: 'json',
      admin: { readOnly: true, description: 'Ödeme sonrası siparişten kopyalanan teslimat adresi.' },
      access: { update: ({ req }) => Boolean(req.user?.role === 'admin') },
    },
    { name: 'carrier', type: 'text', admin: { description: 'Örn: Yurtiçi Kargo, MNG, Aras, Hepsijet' } },
    { name: 'trackingNumber', type: 'text', index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'label_created',
      index: true,
      options: [
        { label: 'Etiket Oluşturuldu', value: 'label_created' },
        { label: 'Yolda', value: 'in_transit' },
        { label: 'Dağıtıma Çıktı', value: 'out_for_delivery' },
        { label: 'Teslim Edildi', value: 'delivered' },
        { label: 'Başarısız', value: 'failed' },
      ],
    },
  ],
}