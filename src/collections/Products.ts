import type { CollectionConfig, Where } from 'payload'
import { getOwnSellerId } from '../access/sellerScope'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
    hidden: ({ user }) => user?.role === 'support',
  },
  access: {
    // Vitrin sadece yayındaki ürünleri görür; satıcı kendi taslaklarını da görür.
    read: async ({ req }): Promise<boolean | Where> => {
      const user = req.user
      if (user?.role === 'admin' || user?.role === 'support') return true
      if (user?.role === 'seller') {
        const sellerId = await getOwnSellerId(req)
        if (sellerId) {
          return {
            or: [{ status: { equals: 'published' } }, { seller: { equals: sellerId } }],
          }
        }
      }
      return { status: { equals: 'published' } }
    },
    create: ({ req: { user } }) => Boolean(user?.role && ['admin', 'seller'].includes(user.role)),
    update: async ({ req }): Promise<boolean | Where> => {
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
    // beforeValidate: `seller` required olduğu için doğrulamadan ÖNCE doldurulmalı.
    beforeValidate: [
      async ({ operation, data, req }) => {
        if (operation === 'create' && req.user?.role === 'seller') {
          const sellerId = await getOwnSellerId(req)
          if (!sellerId) {
            throw new Error('Ürün eklemeden önce bir mağazanız olmalı.')
          }
          const seller = await req.payload.findByID({
            collection: 'sellers',
            id: sellerId,
            depth: 0,
            overrideAccess: true,
          })
          if (seller.status !== 'approved') {
            throw new Error('Mağazanız henüz onaylanmadı, ürün ekleyemezsiniz.')
          }
          data = { ...data, seller: sellerId }
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'seller',
      type: 'relationship',
      relationTo: 'sellers',
      required: true,
      index: true,
      access: { update: ({ req: { user } }) => user?.role === 'admin' }, // ürün başka mağazaya taşınamaz
    },
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