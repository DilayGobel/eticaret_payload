import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@payload-config'

const PRODUCT_ID = 'BURAYA-URUN-UUID'
const SKU_PREFIX = 'KB'
const PRICE = 129900 // kuruş
const STOCK = 10

const axes: Record<string, string[]> = {
  renk: ['Siyah', 'Beyaz', 'Kırmızı'],
  switch: ['Red', 'Blue', 'Brown'],
  baglanti: ['Kablolu', 'Kablosuz'], // Yeni eklenen özellik
}

const combos = Object.entries(axes).reduce<Record<string, string>[]>(
  (acc, [key, vals]) => acc.flatMap((c) => vals.map((v) => ({ ...c, [key]: v }))),
  [{}],
)

const code = (s: string) =>
  s.toLocaleUpperCase('tr-TR').replace(/İ/g, 'I').replace(/[^A-Z0-9]/g, '')

// İki options objesinin aynı kombinasyon olup olmadığını kontrol eder
const isSameOptions = (
  a: Record<string, string> | null | undefined,
  b: Record<string, string>,
) => {
  if (!a) return false
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  return keysB.every((k) => a[k] === b[k])
}

async function main() {
  const payload = await getPayload({ config })

  // Ürüne ait mevcut tüm varyantları tek seferde çek
  const existingRes = await payload.find({
    collection: 'product-variants',
    where: { product: { equals: PRODUCT_ID } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  for (const options of combos) {
    const alreadyExists = existingRes.docs.some((doc) =>
      isSameOptions(doc.options as Record<string, string> | null, options),
    )

    const sku = [SKU_PREFIX, ...Object.values(options).map(code)].join('-')

    if (alreadyExists) {
      console.log('atlandı (kombinasyon var):', options)
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