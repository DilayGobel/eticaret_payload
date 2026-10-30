import { redirect } from 'next/navigation'
import { headers as getHeaders } from 'next/headers'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await getHeaders() })

  if (!user) redirect('/login')

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Hesabım</h1>
      <div className="rounded border bg-white p-4 text-sm">
        <p><strong>Ad Soyad:</strong> {user.firstName} {user.lastName}</p>
        <p><strong>E-posta:</strong> {user.email}</p>
        <p><strong>Rol:</strong> {user.role}</p>
      </div>
    </div>
  )
}