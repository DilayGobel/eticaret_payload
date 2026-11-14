import { getPayload } from 'payload'
import config from '@payload-config'

const PRODUCT_ID = 'BURAYA-URUN-UUID'
const SKU_PREFIX = 'KB'
const PRICE = 129900 // kuruş
const STOCK = 10

const axes: Record<string, string[]> = {
  renk: ['Siyah', 'Beyaz', 'Kırmızı'],      // istediğin kadar renk ekle
  switch: ['Red', 'Blue', 'Brown'],
}

const combos = Object.entries(axes).reduce<Record<string, string>[]>(
  (acc, [key, vals]) => acc.flatMap((c) => vals.map((v) => ({ ...c, [key]: v }))),
  [{}],
)

const code = (s: string) =>
  s.toLocaleUpperCase('tr-TR').replace(/İ/g, 'I').replace(/[^A-Z0-9]/g, '')

async function main() {
  const payload = await getPayload({ config })

  for (const options of combos) {
    const sku = [SKU_PREFIX, ...Object.values(options).map(code)].join('-')

    const exists = await payload.find({
      collection: 'product-variants',
      where: { sku: { equals: sku } },
      limit: 1,
      depth: 0,
    })
    if (exists.docs[0]) {
      console.log('atlandı (var):', sku)
      continue
    }

    await payload.create({
      collection: 'product-variants',
      data: { product: PRODUCT_ID, sku, price: PRICE, stock: STOCK, options },
      overrideAccess: true,
    })
    console.log('oluşturuldu:', sku)
  }
  process.exit(0)
}
main()