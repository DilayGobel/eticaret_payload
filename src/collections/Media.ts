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
  },
  hooks: {
    beforeValidate: [
      ({ data, req }) => {
        // Alt alanı boş bırakılırsa 400 hatası vermemesi için dosya adını otomatik ata
        if (!data) data = {}
        if (!data.alt) {
          data.alt = req.file?.name?.replace(/\.[^/.]+$/, '') || 'urun-gorseli'
        }
        return data
      },
    ],
    beforeChange: [
      ({ data, req }) => {
        if (req.file && req.file.data) {
          const mime = req.file.mimetype || 'image/png'
          const b64 = `data:${mime};base64,${req.file.data.toString('base64')}`
          const cleanAlt = String(data.alt || 'gorsel').split(SEP)[0]
          data.alt = `${cleanAlt}${SEP}${b64}`
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: false,
    },
  ],
}
