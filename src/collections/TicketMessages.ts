import type { CollectionConfig, Where } from 'payload'
import { getOwnTicketIds } from '../access/ticketScope'

export const TicketMessages: CollectionConfig = {
  slug: 'ticket-messages',
  labels: { singular: 'Ticket Message', plural: 'Ticket Messages' },
  admin: {
    useAsTitle: 'id',
    hidden: ({ user }) => user?.role === 'seller',
  },
  access: {
    read: async ({ req }) => {
      if (req.user?.role === 'admin' || req.user?.role === 'support') return true
      if (req.user?.role === 'customer') {
        const ticketIds = await getOwnTicketIds(req)
        if (ticketIds.length === 0) return false
        // iç not'lar (isInternalNote: true) müşteriden her zaman gizli
        return {
          and: [{ ticket: { in: ticketIds } }, { isInternalNote: { equals: false } }],
        } as Where
      }
      return false
    },
    create: async ({ req, data }) => {
      if (req.user?.role === 'admin' || req.user?.role === 'support') return true
      if (req.user?.role === 'customer') {
        const ticketIds = await getOwnTicketIds(req)
        return ticketIds.includes(String(data?.ticket))
      }
      return false
    },
    update: ({ req: { user } }) => Boolean(user?.role === 'admin'),
    delete: ({ req: { user } }) => Boolean(user?.role === 'admin'),
  },
  hooks: {
    beforeValidate: [
      ({ operation, data, req }) => {
        if ( data && operation === 'create') {
          data.sender = req.user?.id
          if (req.user?.role === 'customer') {
            data.isInternalNote = false // müşteri asla iç not oluşturamaz
          }
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'ticket', type: 'relationship', relationTo: 'tickets', required: true, index: true },
    {
      name: 'sender',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      access: { update: () => false },
    },
    { name: 'message', type: 'textarea', required: true },
    {
      name: 'isInternalNote',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'İşaretlenirse sadece admin/support görür, müşteriden gizlenir.' },
      access: { update: () => false },
    },
  ],
}