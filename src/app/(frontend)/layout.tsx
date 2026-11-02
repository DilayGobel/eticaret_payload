import './styles.css'
import { Providers } from '@/components/Providers'
import { Header } from '@/components/Header'
import React from 'react'
import { CartProvider } from '@/components/useCart'


export const metadata = { title: 'E-Ticaret', description: 'Çok satıcılı pazaryeri' }

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <CartProvider>
          <Providers>
          <Header />
          <main>{children}</main>
          </Providers>
        </CartProvider>
      </body>
    </html>
  )
}