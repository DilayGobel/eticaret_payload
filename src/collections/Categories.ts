import type { CollectionConfig } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    hidden: ({ user }) => user?.role === 'support',
  },
  access: {
    read: () => true, // storefront kategori ağacını herkes görebilir
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: false,
      admin: { description: 'Boş bırakılırsa üst düzey (ana) kategori olur.' },
    },
    { name: 'icon', type: 'text' },
    { name: 'isActive', type: 'checkbox', defaultValue: true },
  ],
}