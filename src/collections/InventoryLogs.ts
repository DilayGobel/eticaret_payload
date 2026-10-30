// src/collections/InventoryLogs.ts
// Asla değiştiremeyen geçmiş 
// Admin bile değiştiremez burayı

import type { CollectionConfig } from 'payload'
import { getOwnVariantIds } from '../access/sellerScope'

export const InventoryLogs: CollectionConfig = {
  slug: 'inventory-logs',
  labels: { singular: 'Inventory Log', plural: 'Inventory Logs' },
  admin: {
    useAsTitle: 'id',
    hidden: ({ user }) => user?.role === 'customer',
  },
  access: {
    read: async ({ req }) => {
      if (req.user?.role === 'admin' || req.user?.role === 'support') return true
      if (req.user?.role === 'seller') {
        const variantIds = await getOwnVariantIds(req)
        if (variantIds.length === 0) return false
        return { variant: { in: variantIds } }
      }
      return false
    },
    create: async ({ req, data }) => {
      if (req.user?.role === 'admin') return true
      if (req.user?.role === 'seller') {
        const variantIds = await getOwnVariantIds(req)
        return variantIds.includes(String(data?.variant)) // sadece kendi varyantlarına stok girişi
      }
      return false
    }, // sistem akışları overrideAccess ile geçer
    update: () => false, // append-only: asla düzenlenemez
    delete: () => false, // append-only: asla silinemez
  },
  hooks: {
    beforeValidate: [
      async ({ operation, data, req }) => {
        if (!data) return data
        if (operation !== 'create') return data
        if (req.context?.skipStockApply) return data // sistem zaten kendi transaction'ında stoğu değiştirdi

        if (!data.variant) throw new Error('variant zorunlu.')
        if (typeof data.change !== 'number' || !Number.isInteger(data.change) || data.change === 0) {
          throw new Error('change sıfırdan farklı bir tam sayı olmalı.')
        }
        if (req.user?.role === 'seller' && !['restock', 'manual_correction'].includes(data.reason)) {
          throw new Error('Satıcı sadece stok girişi veya manuel düzeltme yapabilir.')
        }

        const variant = await req.payload.findByID({
          collection: 'product-variants',
          id: data.variant,
          overrideAccess: true,
        })
        const newStock = variant.stock + data.change
        if (newStock < 0) {
          throw new Error('Bu işlem stoğu negatife düşürür, geçersiz.')
        }

        await req.payload.update({
          collection: 'product-variants',
          id: data.variant,
          data: { stock: newStock },
          overrideAccess: true,
        })

        data.newStock = newStock
        return data
      },
    ],
  },
  fields: [
    { name: 'variant', type: 'relationship', relationTo: 'product-variants', required: true, index: true },
    {
      name: 'change',
      type: 'number',
      required: true,
      admin: { description: 'Pozitif = stok girişi, negatif = stok çıkışı.' },
    },
    {
      name: 'newStock',
      type: 'number',
      required: true,
      admin: { readOnly: true, description: 'İşlem sonrası kesin bakiye (otomatik hesaplanır).' },
    },
    {
      name: 'reason',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Sipariş Verildi', value: 'order_placed' },
        { label: 'Sipariş İptal', value: 'order_cancelled' },
        { label: 'İade Kabul', value: 'return_accepted' },
        { label: 'Stok Girişi (Restock)', value: 'restock' },
        { label: 'Manuel Düzeltme', value: 'manual_correction' },
      ],
    },
    {
      name: 'referenceId',
      type: 'text',
      index: true,
      admin: { description: 'Bağlı sipariş numarası ya da tedarik irsaliye no.' },
    },
  ],
}