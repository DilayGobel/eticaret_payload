'use client'
import Link from 'next/link'
import { useAuth } from './Providers'
import { useCart } from './useCart'

export function Header() {
  const { user, logout } = useAuth()
  const { count } = useCart()
  return (
    <header className="site-header">
      <Link href="/" className="logo">E-Ticaret</Link>
      <form action="/" className="search">
        <input name="q" placeholder="Ürün ara…" />
      </form>
      <nav>
        <Link href="/cart">Sepet{count > 0 && <span className="badge">{count}</span>}</Link>
        {user ? (
          <>
            <Link href="/orders">Siparişlerim</Link>
            <Link href="/support">Destek</Link>
            {user.role === 'seller' && <Link href="/seller">Mağazam</Link>}
            {(user.role === 'admin' || user.role === 'support') && <a href="/admin">Panel</a>}
            <button className="link" onClick={logout}>Çıkış ({user.firstName})</button>
          </>
        ) : (
          <>
            <Link href="/login">Giriş</Link>
            <Link href="/register">Kayıt Ol</Link>
          </>
        )}
      </nav>
    </header>
  )
}