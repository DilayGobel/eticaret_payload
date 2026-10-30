import type { CollectionConfig, Where } from 'payload'

export const Tickets: CollectionConfig = {
  slug: 'tickets',
  admin: {
    useAsTitle: 'ticketNumber',
    hidden: ({ user }) => Boolean(user && user.role === 'seller'),
  },
  access: {
    read: ({ req: { user } }) => {
      if (user && ['admin', 'support'].includes(user.role)) return true
      if (user && user.role === 'customer') {
        return { customer: { equals: user.id } } as Where
      }
      return false
    },
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => {
      if (!user) return false
      return ['admin', 'support'].includes(user.role)
    },
    delete: ({ req: { user } }) => Boolean(user && user.role === 'admin'),
  },
  hooks: {
    beforeValidate: [
      ({ operation, data, req }) => {
        if ( data &&operation === 'create') {
          if (!data.ticketNumber) {
            data.ticketNumber = `TCK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
          }
          if (req.user && req.user.role === 'customer') {
            data.customer = req.user.id
          }
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'ticketNumber', type: 'text', unique: true, index: true, admin: { readOnly: true } },
    { name: 'subject', type: 'text', required: true },
    { name: 'customer', type: 'relationship', relationTo: 'users', required: true, index: true },
    {
      name: 'assignedTo',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: { description: 'Devralan destek temsilcisi veya admin.' },
    },
    { name: 'relatedOrder', type: 'relationship', relationTo: 'orders' },
    {
      name: 'priority',
      type: 'select',
      required: true,
      defaultValue: 'medium',
      options: [
        { label: 'Düşük', value: 'low' },
        { label: 'Orta', value: 'medium' },
        { label: 'Yüksek', value: 'high' },
        { label: 'Acil', value: 'urgent' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      index: true,
      options: [
        { label: 'Açık', value: 'open' },
        { label: 'İşlemde', value: 'in_progress' },
        { label: 'Çözüldü', value: 'resolved' },
        { label: 'Kapatıldı', value: 'closed' },
      ],
    },
  ],
}