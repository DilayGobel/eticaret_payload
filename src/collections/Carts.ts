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
      if (req.user) return { user: { equals: req.user.id } }
      const guestToken = getGuestToken(req)
      if (!guestToken) return false
      return { guestToken: { equals: guestToken } }
    },
    create: () => true,
    update: async ({ req }): Promise<boolean | Where> => {
      if (req.user?.role === 'admin') return true
      if (req.user) return { user: { equals: req.user.id } }
      const guestToken = getGuestToken(req)
      if (!guestToken) return false
      return { guestToken: { equals: guestToken } }
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
    // ───────────── merge-guest (mevcut) ─────────────
    {
      path: '/merge-guest',
      method: 'post',
      handler: async (req) => {
        if (!req.user) {
          return Response.json({ error: 'Giriş yapmalısınız.' }, { status: 401 })
        }

        const body = (typeof req.json === 'function' ? await req.json() : req.data) as
          | Record<string, unknown>
          | undefined
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

    // ───────────── summary (yeni) ─────────────
    {
      path: '/summary',
      method: 'get',
      handler: async (req) => {
        const guestToken = getGuestToken(req)
        if (!req.user && !guestToken) return Response.json({ cartId: null, items: [] })

        const where: Where = req.user
          ? { user: { equals: req.user.id } }
          : { guestToken: { equals: guestToken as string } }

        const cartsRes = await req.payload.find({
          collection: 'carts',
          where,
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const cart = cartsRes.docs[0]
        if (!cart) return Response.json({ cartId: null, items: [] })

        const itemsRes = await req.payload.find({
          collection: 'cart-items',
          where: { cart: { equals: cart.id } },
          depth: 0,
          pagination: false,
          select: { variant: true, quantity: true },
          overrideAccess: true,
        })

        return Response.json({
          cartId: cart.id,
          items: itemsRes.docs.map((i) => ({
            variantId: String(i.variant),
            quantity: i.quantity,
          })),
        })
      },
    },

    // ───────────── add-item (yeni) ─────────────
    {
      path: '/add-item',
      method: 'post',
      handler: async (req) => {
        const body = (typeof req.json === 'function' ? await req.json() : req.data) as
          | { variantId?: string; delta?: number }
          | undefined

        const variantId = body?.variantId
        const delta = Number(body?.delta ?? 1)
        if (!variantId || !delta) {
          return Response.json({ error: 'variantId ve delta zorunlu.' }, { status: 400 })
        }

        const guestToken = getGuestToken(req)
        if (!req.user && !guestToken) {
          return Response.json({ error: 'Kimlik yok.' }, { status: 401 })
        }

        const cartWhere: Where = req.user
          ? { user: { equals: req.user.id } }
          : { guestToken: { equals: guestToken as string } }

        const [cartsRes, variant] = await Promise.all([
          req.payload.find({
            collection: 'carts',
            where: cartWhere,
            limit: 1,
            depth: 0,
            overrideAccess: true,
          }),
          req.payload.findByID({
            collection: 'product-variants',
            id: variantId,
            depth: 0,
            overrideAccess: true,
          }),
        ])

        const cart =
          cartsRes.docs[0] ??
          (await req.payload.create({
            collection: 'carts',
            data: req.user ? { user: req.user.id } : { guestToken: guestToken as string },
            overrideAccess: true,
            req, // beforeChange hook'u req.user / header'a bakıyor
          }))

        const existingRes = await req.payload.find({
          collection: 'cart-items',
          where: { and: [{ cart: { equals: cart.id } }, { variant: { equals: variantId } }] },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const existing = existingRes.docs[0]
        const newQty = (existing?.quantity ?? 0) + delta

        if (newQty > variant.stock) {
          return Response.json({ error: 'Yetersiz stok.' }, { status: 409 })
        }

        if (newQty <= 0) {
          if (existing) {
            await req.payload.delete({
              collection: 'cart-items',
              id: existing.id,
              overrideAccess: true,
            })
          }
          return Response.json({ variantId, quantity: 0 })
        }

        if (existing) {
          await req.payload.update({
            collection: 'cart-items',
            id: existing.id,
            data: { quantity: newQty },
            depth: 0,
            overrideAccess: true,
          })
        } else {
          await req.payload.create({
            collection: 'cart-items',
            data: { cart: cart.id, variant: variantId, quantity: newQty },
            depth: 0,
            overrideAccess: true,
          })
        }

        return Response.json({ variantId, quantity: newQty })
      },
    },
  ],
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', index: true },
    { name: 'guestToken', type: 'text', index: true },
  ],
}