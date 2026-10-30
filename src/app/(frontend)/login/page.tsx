'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/components/Providers'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { await login(email, password); router.push('/') }
    catch (err: any) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <form className="form stack panel" onSubmit={submit}>
      <h1>Giriş Yap</h1>
      <input type="email" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <div className="error">{error}</div>}
      <button disabled={busy}>Giriş</button>
      <span className="muted">Hesabın yok mu? <Link href="/register">Kayıt ol</Link></span>
    </form>
  )
}