import type { CollectionConfig, Where } from 'payload'
import { getGuestToken } from '../access/cartScope'

export const Carts: CollectionConfig = {
  slug: 'carts',
  admin: {
    useAsTitle: 'id',
    hidden: ({ user }) => user?.role === 'support' || user?.role === 'seller',
  },
  access: {
    read: async ({ req }): Promise<boolean | Where> => {
      if (req.user?.role === 'admin') return true
      if (req.user) {
        return {
          user: {
            equals: req.user.id,
          },
        }
      }
      const guestToken = getGuestToken(req)
      if (!guestToken) return false
      return {
        guestToken: {
          equals: guestToken,
        },
      }
    },
    create: () => true,
    update: async ({ req }): Promise<boolean | Where> => {
      if (req.user?.role === 'admin') return true
      if (req.user) {
        return {
          user: {
            equals: req.user.id,
          },
        }
      }
      const guestToken = getGuestToken(req)
      if (!guestToken) return false
      return {
        guestToken: {
          equals: guestToken,
        },
      }
    },
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    beforeChange: [
      ({ operation, data, req }) => {
        if (operation !== 'create') return data

        if (req.user) {
          data.user = req.user.id
          data.guestToken = null
        } else {
          const guestToken = getGuestToken(req)
          if (!guestToken) {
            throw new Error('Misafir sepeti için x-guest-token header zorunludur.')
          }
          data.user = null
          data.guestToken = guestToken
        }

        return data
      },
    ],
  },
  endpoints: [
    {
      path: '/merge-guest',
      method: 'post',
      handler: async (req) => {
        if (!req.user) {
          return Response.json({ error: 'Giriş yapmalısınız.' }, { status: 401 })
        }

        // req.json güvenli okuma (PayloadRequest uyumlu)
        const body = (typeof req.json === 'function' ? await req.json() : req.data) as Record<string, unknown> | undefined
        const guestToken = body?.guestToken as string | undefined

        if (!guestToken) {
          return Response.json({ error: 'guestToken zorunlu.' }, { status: 400 })
        }

        const guestCarts = await req.payload.find({
          collection: 'carts',
          where: { guestToken: { equals: guestToken } },
          limit: 1,
          overrideAccess: true,
        })
        const guestCart = guestCarts.docs[0]

        if (!guestCart) {
          return Response.json({ merged: false, reason: 'Misafir sepeti bulunamadı.' })
        }

        const userCarts = await req.payload.find({
          collection: 'carts',
          where: { user: { equals: req.user.id } },
          limit: 1,
          overrideAccess: true,
        })

        let userCart = userCarts.docs[0]
        if (!userCart) {
          userCart = await req.payload.create({
            collection: 'carts',
            data: { user: req.user.id },
            overrideAccess: true,
          })
        }

        const guestItems = await req.payload.find({
          collection: 'cart-items',
          where: { cart: { equals: guestCart.id } },
          pagination: false,
          overrideAccess: true,
        })

        for (const item of guestItems.docs) {
          const variantId = typeof item.variant === 'object' ? item.variant.id : item.variant

          const existing = await req.payload.find({
            collection: 'cart-items',
            where: {
              and: [{ cart: { equals: userCart.id } }, { variant: { equals: variantId } }],
            },
            limit: 1,
            overrideAccess: true,
          })

          if (existing.docs[0]) {
            await req.payload.update({
              collection: 'cart-items',
              id: existing.docs[0].id,
              data: { quantity: (existing.docs[0].quantity as number) + (item.quantity as number) },
              overrideAccess: true,
            })
          } else {
            await req.payload.create({
              collection: 'cart-items',
              data: { cart: userCart.id, variant: variantId, quantity: item.quantity },
              overrideAccess: true,
            })
          }

          await req.payload.delete({ collection: 'cart-items', id: item.id, overrideAccess: true })
        }

        await req.payload.delete({ collection: 'carts', id: guestCart.id, overrideAccess: true })

        return Response.json({ merged: true, cartId: userCart.id })
      },
    },
  ],
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', index: true },
    { name: 'guestToken', type: 'text', index: true },
  ],
}