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
    beforeChange: [
      ({ data, req }) => {
        if (req.file && req.file.data) {
          const mime = req.file.mimetype || 'image/png'
          const b64 = `data:${mime};base64,${req.file.data.toString('base64')}`
          const cleanAlt = (data.alt || '').split(SEP)[0]
          // Migration gerektirmemek için Base64 verisini mevcut metin sütununda sakla
          data.alt = `${cleanAlt}${SEP}${b64}`
          data.url = b64
        }
        return data
      },
    ],
    afterRead: [
      ({ doc }) => {
        if (doc && typeof doc.alt === 'string' && doc.alt.includes(SEP)) {
          const [cleanAlt, b64] = doc.alt.split(SEP)
          doc.alt = cleanAlt
          doc.url = b64
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
    {
      name: 'url',
      type: 'text',
      hooks: {
        afterRead: [
          ({ value, siblingData }) => {
            if (typeof siblingData?.alt === 'string' && siblingData.alt.includes(SEP)) {
              return siblingData.alt.split(SEP)[1]
            }
            return value
          },
        ],
      },
    },
  ],
}
