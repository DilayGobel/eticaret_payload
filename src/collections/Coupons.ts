import type { CollectionConfig } from 'payload'
import { integerMoney } from '@/utils/money'
import { calcDiscount } from '@/utils/coupon'

export const Coupons: CollectionConfig = {
  slug: 'coupons',
  admin: {
    useAsTitle: 'code',
    hidden: ({ user }) => user?.role === 'support' || user?.role === 'seller',
  },
  access: {
    // Artık kod listesi herkese açık değil. Vitrin doğrulamayı POST /api/coupons/validate ile yapar.
    read: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'support',
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  endpoints: [
    {
      path: '/validate',
      method: 'post',
      handler: async (req) => {
        const body = (typeof req.json === 'function' ? await req.json() : req.data) as any
        const code = String(body?.code || '').toUpperCase().trim()
        const subtotal = Number(body?.subtotal)
        if (!code || !Number.isInteger(subtotal) || subtotal < 0) {
          return Response.json({ valid: false, error: 'code ve subtotal (kuruş) zorunlu.' }, { status: 400 })
        }
        const res = await req.payload.find({
          collection: 'coupons',
          where: { code: { equals: code } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        try {
          const discountAmount = calcDiscount(res.docs[0], subtotal)
          return Response.json({ valid: true, code, discountAmount })
        } catch (e: any) {
          return Response.json({ valid: false, error: e.message }, { status: 400 })
        }
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data?.code) data.code = String(data.code).toUpperCase().trim()
        return data
      },
    ],
  },
  fields: [
    { name: 'code', type: 'text', required: true, unique: true, index: true },
    {
      name: 'discountType',
      type: 'select',
      required: true,
      options: [
        { label: 'Yüzde (%)', value: 'percentage' },
        { label: 'Sabit Tutar', value: 'fixed_amount' },
      ],
    },
    {
      name: 'discountValue',
      type: 'number',
      required: true,
      min: 0,
      admin: { description: 'percentage için 0-100; fixed_amount için kuruş.' },
      validate: integerMoney,
    },
    {
      name: 'minCart',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { description: 'Uygulanabilmesi için gereken minimum sepet tutarı (kuruş).' },
    },
    { name: 'usageLimit', type: 'number', min: 1, admin: { description: 'Boş = sınırsız.' } },
    {
      name: 'usageCount',
      type: 'number',
      defaultValue: 0,
      access: { update: () => false },
      admin: { readOnly: true, description: 'Sipariş verilince otomatik artar, iptalde azalır.' },
    },
    { name: 'isActive', type: 'checkbox', defaultValue: true },
  ],
}