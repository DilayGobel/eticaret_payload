import type { CollectionConfig } from 'payload'
import { getOwnSellerId } from '../access/sellerScope'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
    hidden: ({ user }) => user?.role === 'support',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user?.role && ['admin', 'seller'].includes(user.role)),
    update: async ({ req }) => {
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
  hooks: {
    beforeValidate: [
      async ({ operation, data, originalDoc, req }) => {
        if (req.user?.role !== 'seller' || !data) return data

        const sellerId = await getOwnSellerId(req)
        if (!sellerId) {
          throw new Error('Ürün eklemeden önce bir mağazanız olmalı.')
        }

        if (operation === 'create') {
          const seller = await req.payload.findByID({
            collection: 'sellers',
            id: sellerId,
            depth: 0,
          })
          if (seller.status !== 'approved') {
            throw new Error('Mağazanız henüz onaylanmadı, ürün ekleyemezsiniz.')
          }
        }

        // Satıcı her zaman kendi mağazasına yazar; gönderdiği seller değeri yok sayılır.
        data.seller = sellerId

        // Yayına alma yetkisi sadece admin'de.
        if (
          data.status &&
          data.status !== originalDoc?.status &&
          !['draft', 'archived'].includes(data.status)
        ) {
          throw new Error('Ürünü yayına sadece yönetici alabilir. Taslak olarak kaydedin.')
        }
        if (operation === 'create' && !data.status) data.status = 'draft'

        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'seller', type: 'relationship', relationTo: 'sellers', required: true, index: true },
    { name: 'category', type: 'relationship', relationTo: 'categories', required: true, index: true },
    { name: 'description', type: 'textarea' },
    { name: 'images', type: 'upload', relationTo: 'media', hasMany: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: [
        { label: 'Taslak', value: 'draft' },
        { label: 'Yayında', value: 'published' },
        { label: 'Arşivlendi', value: 'archived' },
        { label: 'Reddedildi', value: 'rejected' },
      ],
    },
  ],
}