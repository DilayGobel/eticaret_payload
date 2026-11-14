import type { CollectionConfig } from 'payload'

const SEP = '|||'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  upload: {
    disableLocalStorage: true,
     focalPoint: false,
    crop: false,
  },
  hooks: {
    beforeValidate: [
      ({ data, req }) => {
        if (!data) data = {}
        const cleanAlt = String(data.alt || req.file?.name?.replace(/\.[^/.]+$/, '') || 'gorsel').split(SEP)[0]
        if (req.file && req.file.data) {
          const mime = req.file.mimetype || 'image/png'
          const b64 = `data:${mime};base64,${req.file.data.toString('base64')}`
          data.alt = `${cleanAlt}${SEP}${b64}`
        } else if (!data.alt) {
          data.alt = cleanAlt
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'textarea', // Uzun Base64 verisi için text yerine textarea ve sınırsız validate
      required: false,
      maxLength: 50000000,
      validate: () => true,
    },
  ],
}
