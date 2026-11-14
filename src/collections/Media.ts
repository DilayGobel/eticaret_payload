import type { CollectionConfig } from 'payload'
import sharp from 'sharp'

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
    beforeOperation: [
      async ({ args, operation, req }) => {
        // Aynı dosya tekrar yüklendiğinde UNIQUE filename (400) hatasını önlemek için dosya adını benzersiz yap
        if ((operation === 'create' || operation === 'update') && req.file) {
          const origName = req.file.name || 'image.png'
          const dotIdx = origName.lastIndexOf('.')
          const base = dotIdx !== -1 ? origName.slice(0, dotIdx) : origName
          const ext = dotIdx !== -1 ? origName.slice(dotIdx) : '.webp'
          const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
          req.file.name = `${base}-${uniqueSuffix}${ext}`
          if (args.data) {
            args.data.filename = req.file.name
          }
        }
        return args
      },
    ],
    beforeValidate: [
      async ({ data, req }) => {
        if (!data) data = {}
        const cleanAlt = String(
          data.alt || req.file?.name?.replace(/\.[^/.]+$/, '') || 'gorsel'
        ).split(SEP)[0]

        if (req.file && req.file.data) {
          let buf: Buffer = req.file.data
          let mime = req.file.mimetype || 'image/png'

          // Resmi optimize et (hem hızlı yüklenir hem veritabanını şişirmez)
          try {
            buf = await sharp(req.file.data)
              .resize({ width: 900, withoutEnlargement: true })
              .webp({ quality: 82 })
              .toBuffer()
            mime = 'image/webp'
          } catch {
            // sharp dönüştüremezse orijinal buffer kalsın
          }

          const b64 = `data:${mime};base64,${buf.toString('base64')}`
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
      type: 'textarea',
      required: false,
      maxLength: 50000000,
      validate: () => true,
    },
  ],
}
