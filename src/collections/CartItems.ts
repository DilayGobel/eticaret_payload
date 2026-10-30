import type { CollectionConfig } from 'payload'
import { getOwnCartIds } from '../access/cartScope'

export const CartItems: CollectionConfig = {
  slug: 'cart-items',
  labels: { singular: 'Cart Item', plural: 'Cart Items' },
  admin: {
    useAsTitle: 'id',
    hidden: ({ user }) => user?.role === 'support' || user?.role === 'seller',
  },
  access: {
    read: async ({ req }) => {
      if (req.user?.role === 'admin') return true
      const cartIds = await getOwnCartIds(req)
      if (cartIds.length === 0) return false
      return { cart: { in: cartIds } }
    },
    create: async ({ req, data }) => {
      if (req.user?.role === 'admin') return true
      const cartIds = await getOwnCartIds(req)
      return cartIds.includes(String(data?.cart))
    },
    update: async ({ req }) => {
      if (req.user?.role === 'admin') return true
      const cartIds = await getOwnCartIds(req)
      if (cartIds.length === 0) return false
      return { cart: { in: cartIds } }
    },
    delete: async ({ req }) => {
      if (req.user?.role === 'admin') return true
      const cartIds = await getOwnCartIds(req)
      if (cartIds.length === 0) return false
      return { cart: { in: cartIds } }
    },
  },
  fields: [
    { name: 'cart', type: 'relationship', relationTo: 'carts', required: true, index: true },
    { name: 'variant', type: 'relationship', relationTo: 'product-variants', required: true, index: true },
    { name: 'quantity', type: 'number', required: true, defaultValue: 1, min: 1 },
  ],
}