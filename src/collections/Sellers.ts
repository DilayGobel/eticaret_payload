import type { CollectionConfig } from 'payload'

const isAdmin = ({ req: { user } }: { req: { user: any } }) => user?.role === 'admin'
const isAdminOrOwner = ({ req, doc }: { req: { user: any }; doc?: any }) => {
  if (req.user?.role === 'admin') return true
  if (!doc || !req.user) return false
  const ownerId = typeof doc.owner === 'object' ? doc.owner?.id : doc.owner
  return String(ownerId) === String(req.user.id)
}

export const Sellers: CollectionConfig = {
  slug: 'sellers',
  admin: {
    useAsTitle: 'storeName',
    hidden: ({ user }) => user?.role === 'support',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user?.role === 'seller') return { owner: { equals: user.id } }
      return false
    },
    delete: isAdmin,
  },
  hooks: {
    // beforeValidate: owner required; ayrıca alan-seviyesi `update` erişimi create'te
    // devreye girmediği için başvuruda komisyon/status'u burada zorla sıfırlıyoruz.
    beforeValidate: [
      ({ operation, data, req }) => {
        if (operation === 'create' && req.user?.role !== 'admin') {
          data = { ...data, owner: req.user?.id, status: 'pending', commissionRate: 10 }
        }
        return data
      },
    ],
    // Admin onaylayınca sahibi otomatik "seller" rolüne yükselir (portal girişi için şart).
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        if (doc.status === 'approved' && previousDoc?.status !== 'approved') {
          const ownerId = typeof doc.owner === 'object' ? doc.owner.id : doc.owner
          await req.payload.update({
            collection: 'users',
            id: ownerId,
            data: { role: 'seller' },
            overrideAccess: true,
          })
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'owner', type: 'relationship', relationTo: 'users', required: true, unique: true, index: true },
    { name: 'storeName', type: 'text', required: true, unique: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'taxId', type: 'text', required: true, unique: true, label: 'VKN / TCKN', access: { read: isAdminOrOwner } },
    {
      name: 'commissionRate',
      type: 'number',
      required: true,
      defaultValue: 10,
      min: 0,
      max: 100,
      admin: { description: 'Yüzde (%) cinsinden komisyon oranı' },
      access: { update: isAdmin },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Onay Bekliyor', value: 'pending' },
        { label: 'Onaylandı', value: 'approved' },
        { label: 'Reddedildi', value: 'rejected' },
        { label: 'Askıya Alındı', value: 'suspended' },
      ],
      access: { update: isAdmin },
    },
    { name: 'payoutIban', type: 'text', required: true, label: 'IBAN', access: { read: isAdminOrOwner, update: isAdminOrOwner } },
  ],
}