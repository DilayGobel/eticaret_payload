import Link from 'next/link'
import { formatPrice } from '@/lib/format'

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ no?: string; amount?: string }>
}) {
  const { no, amount } = await searchParams

  return (
    <div className="mx-auto max-w-md rounded border bg-white p-6 text-center">
      <h1 className="mb-2 text-2xl font-semibold">Siparişin alındı</h1>
      <p className="text-sm text-gray-600">Sipariş numarası: <strong>{no}</strong></p>
      {amount && <p className="text-sm text-gray-600">Toplam: {formatPrice(Number(amount))}</p>}
      <p className="mt-3 text-sm text-gray-500">Ödeme onaylandığında siparişin hazırlanmaya başlayacak.</p>
      <Link href="/" className="mt-4 inline-block underline">Alışverişe devam et</Link>
    </div>
  )
}