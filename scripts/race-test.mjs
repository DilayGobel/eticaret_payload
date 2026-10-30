const BASE = 'http://localhost:3000/api'

async function call(path, token, method = 'GET', body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `JWT ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}

async function registerAndLogin(email) {
  const password = 'Test1234!'
  await call('/users', null, 'POST', { email, password, firstName: 'Race', lastName: 'Test' })
  const login = await call('/users/login', null, 'POST', { email, password })
  if (!login.data?.token) throw new Error(`Giriş başarısız: ${email}`)
  return { token: login.data.token, userId: login.data.user.id }
}

async function newAddress(token, userId) {
  const res = await call('/addresses', token, 'POST', {
    user: userId, title: 'Test', fullName: 'Race Test', phone: '5550000000',
    city: 'İstanbul', district: 'Kadıköy', addressLine: 'Yarış testi adresi', type: 'both',
  })
  if (!res.data?.doc?.id) throw new Error('Adres oluşturulamadı: ' + JSON.stringify(res.data))
  return res.data.doc.id
}

async function prepareCart(token, variantId, quantity) {
  const found = await call('/carts?limit=1&depth=0', token)
  let cartId = found.data?.docs?.[0]?.id
  if (!cartId) cartId = (await call('/carts', token, 'POST', {})).data.doc.id

  const items = await call(`/cart-items?where[cart][equals]=${cartId}&limit=50&depth=0`, token)
  for (const it of items.data?.docs ?? []) await call(`/cart-items/${it.id}`, token, 'DELETE')
  await call('/cart-items', token, 'POST', { cart: cartId, variant: variantId, quantity })
}

const placeOrder = (token, addressId) =>
  call('/orders/place-from-cart', token, 'POST', { addressId, paymentProvider: 'bank_transfer' })

const getStock = async (variantId) => (await call(`/product-variants/${variantId}?depth=0`)).data?.stock

const [variantId, mode] = process.argv.slice(2)
if (!variantId || !['lastitem', 'doublesubmit'].includes(mode)) {
  console.error('Kullanım: node scripts/race-test.mjs <VARIANT_ID> <lastitem|doublesubmit>')
  process.exit(1)
}

const before = await getStock(variantId)
console.log(`Başlangıç stoku: ${before}`)
let results, expectedStock

if (mode === 'lastitem') {
  // İki FARKLI müşteri, son 1 adet için aynı anda sipariş veriyor
  if (before !== 1) { console.error('Bu senaryo için stok tam olarak 1 olmalı.'); process.exit(1) }
  const a = await registerAndLogin('race-a@test.com')
  const b = await registerAndLogin('race-b@test.com')
  const [addrA, addrB] = await Promise.all([newAddress(a.token, a.userId), newAddress(b.token, b.userId)])
  await prepareCart(a.token, variantId, 1)
  await prepareCart(b.token, variantId, 1)
  console.log('İki müşteri AYNI ANDA son ürünü sipariş ediyor...')
  results = await Promise.all([placeOrder(a.token, addrA), placeOrder(b.token, addrB)])
  expectedStock = 0
} else {
  // AYNI müşteri, aynı sepetle iki kez aynı anda sipariş veriyor (çift tıklama)
  if (before < 2) { console.error('Bu senaryo için stok en az 2 olmalı.'); process.exit(1) }
  const c = await registerAndLogin('race-c@test.com')
  const addr = await newAddress(c.token, c.userId)
  await prepareCart(c.token, variantId, 1)
  console.log('Aynı sepet için iki sipariş isteği AYNI ANDA gönderiliyor...')
  results = await Promise.all([placeOrder(c.token, addr), placeOrder(c.token, addr)])
  expectedStock = before - 1
}

results.forEach((r, i) => console.log(`İstek ${i + 1}: HTTP ${r.status} -`, r.data?.orderNumber ?? r.data?.error))

const successCount = results.filter((r) => r.status === 200).length
const after = await getStock(variantId)
console.log(`\nBaşarılı sipariş: ${successCount} (beklenen: 1)`)
console.log(`Son stok: ${after} (beklenen: ${expectedStock})`)
console.log(successCount === 1 && after === expectedStock ? 'SONUÇ: PASS' : 'SONUÇ: FAIL')