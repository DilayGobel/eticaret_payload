import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  upload: {
    disableLocalStorage: true, // Vercel salt-okunur disk hatasını (500) engeller
  },
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        if (req.file && req.file.data) {
          const mime = req.file.mimetype || 'image/jpeg'
          const b64 = req.file.data.toString('base64')
          data.url = `data:${mime};base64,${b64}`
        }
        return data
      },
    ],
    afterRead: [
      ({ doc }) => {
        // Payload'un yerel dosya URL'si üretip Base64 URL'yi ezmesini engelle
        if (doc?.url && doc.url.startsWith('data:')) {
          return doc
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
}
