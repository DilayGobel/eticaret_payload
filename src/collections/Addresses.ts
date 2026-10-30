import type { CollectionConfig } from 'payload'

export const Addresses: CollectionConfig = {
  slug: 'addresses',
  admin: {
    useAsTitle: 'title',
    hidden: ({ user }) => user?.role === 'seller',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user?.role === 'admin' || user?.role === 'support') return true
      if (user) return { user: { equals: user.id } }
      return false
    },
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user) return { user: { equals: user.id } }
      return false
    },
    delete: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      if (user) return { user: { equals: user.id } }
      return false
    },
  },
  hooks: {
    beforeValidate: [
      ({ operation, data, req }) => {
        if (data && operation === 'create' && req.user?.role !== 'admin') {
          data.user = req.user?.id // başkasının adına adres ekleyemesin
        }
        return data
      },
    ],
  },
  
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'title', type: 'text', required: true, admin: { description: 'Örn: "Ev", "İş"' } },
    { name: 'fullName', type: 'text', required: true },
    { name: 'phone', type: 'text', required: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'shipping',
      options: [
        { label: 'Teslimat', value: 'shipping' },
        { label: 'Fatura', value: 'billing' },
        { label: 'Her ikisi', value: 'both' },
      ],
    },
    { name: 'city', type: 'text', required: true },
    { name: 'district', type: 'text', required: true },
    { name: 'addressLine', type: 'textarea', required: true },
    { name: 'postalCode', type: 'text' },
    {
      name: 'taxNumber',
      type: 'text',
      admin: { description: 'Kurumsal fatura için VKN/TCKN (opsiyonel).' },
    },
    { name: 'taxOffice', type: 'text' },
  ],
}