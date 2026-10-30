'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/components/Providers'

export default function RegisterPage() {
  const { register } = useAuth()
  const router = useRouter()
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { await register(f); router.push('/') }
    catch (err: any) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <form className="form stack panel" onSubmit={submit}>
      <h1>Kayıt Ol</h1>
      <input placeholder="Ad" value={f.firstName} onChange={set('firstName')} required />
      <input placeholder="Soyad" value={f.lastName} onChange={set('lastName')} required />
      <input type="email" placeholder="E-posta" value={f.email} onChange={set('email')} required />
      <input type="password" placeholder="Şifre" value={f.password} onChange={set('password')} required minLength={8} />
      {error && <div className="error">{error}</div>}
      <button disabled={busy}>Hesap Oluştur</button>
      <span className="muted">Zaten üye misin? <Link href="/login">Giriş yap</Link></span>
    </form>
  )
}