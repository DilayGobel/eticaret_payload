'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/users/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <button onClick={handleLogout} className="text-red-600 hover:underline">
      Çıkış
    </button>
  )
}