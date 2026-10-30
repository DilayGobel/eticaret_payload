'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, clearGuestToken, hasGuestToken, getGuestToken, notifyCartChanged } from '@/lib/api'

type AuthCtx = {
  user: any | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>
  logout: () => Promise<void>
}
const Ctx = createContext<AuthCtx>(null as any)
export const useAuth = () => useContext(Ctx)

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await api('/users/me')
      setUser(res.user ?? null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = async (email: string, password: string) => {
    await api('/users/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    // Misafirken doldurulan sepeti hesaba aktar
    if (hasGuestToken()) {
      try {
        await api('/carts/merge-guest', { method: 'POST', body: JSON.stringify({ guestToken: getGuestToken() }) })
      } catch {}
      clearGuestToken()
    }
    await refresh()
    notifyCartChanged()
  }

  const register = async (data: any) => {
    await api('/users', { method: 'POST', body: JSON.stringify(data) })
    await login(data.email, data.password)
  }

  const logout = async () => {
    await api('/users/logout', { method: 'POST' })
    setUser(null)
    notifyCartChanged()
  }

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>
}