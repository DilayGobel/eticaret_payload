import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName', 'role', 'status'],
  },
  access: {
    // /admin paneline SADECE admin ve support girebilir.
    // seller/customer giriş yapabilir ama panele erişemez (ileride
    // kendi portallarını kuracağız: /seller ve storefront).
    admin: ({ req: { user } }) => {
      return user?.role === 'admin' || user?.role === 'support'
    },
    create: () => true, // storefront'tan herkes kayıt olabilir, role hook'ta korunuyor
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin' || user.role === 'support') return true
      return { id: { equals: user.id } } // herkes sadece kendi kaydını görür
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin' || user.role === 'support') return true
      return { id: { equals: user.id } }
    },
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  hooks: {
    beforeChange: [ 
      async ({ operation, data, req }) => {
        if (operation !== 'create') return data

        const { totalDocs } = await req.payload.count({ collection: 'users' })

        if (totalDocs === 0) {
          // Sistemdeki gerçek ilk kullanıcı: Payload'un onboarding
          // ekranından oluşturulur, otomatik admin yapılır.
          data.role = 'admin'
        } else if (req.user?.role === 'admin') {
          // Bir admin, panelden yeni personel/satıcı ekliyor — seçtiği
          // rolü aynen koru.
        } else {
          // Herkese açık kayıt (storefront) ya da admin olmayan biri:
          // gönderdiği her şeyi yok say, her zaman customer.
          data.role = 'customer'
        }

        return data
      },
    ],    beforeLogin: [
      ({ user }) => {
        if (user.status !== 'active') {
          throw new Error('Hesabınız aktif değil. Destek ile iletişime geçin.')
        }
        return user
      },
    ],
  },
  fields: [
    {
      name: 'firstName',
      type: 'text',
      required: true,
    },
    {
      name: 'lastName',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'customer',
      index: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Destek (Support)', value: 'support' },
        { label: 'Satıcı (Seller)', value: 'seller' },
        { label: 'Müşteri (Customer)', value: 'customer' },
      ],
      access: {
        // Var olan bir kaydın role'ünü sadece admin değiştirebilir.
        update: ({ req: { user } }) => user?.role === 'admin',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Aktif', value: 'active' },
        { label: 'Pasif', value: 'inactive' },
        { label: 'Yasaklı', value: 'banned' },
      ],
      access: {
        update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'support',
      },
    },
  ],
}