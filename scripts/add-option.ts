import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'




const PRODUCT_ID = 'BURAYA-URUN-UUID' // Güncellenecek ürünün ID'si
const KEY = 'baglanti'
const DEFAULT_VALUE = 'Kablolu'

async function main() {
  const payload = await getPayload({ config })

  const res = await payload.find({
    collection: 'product-variants',
    where: { product: { equals: PRODUCT_ID } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  for (const v of res.docs) {
    const options = { ...((v.options as Record<string, string>) ?? {}) }
    if (options[KEY]) continue

    options[KEY] = DEFAULT_VALUE
    await payload.update({
      collection: 'product-variants',
      id: v.id,
      data: { options },
      overrideAccess: true,
    })
    console.log('güncellendi:', v.sku, '->', options)
  }

  process.exit(0)
}

main()