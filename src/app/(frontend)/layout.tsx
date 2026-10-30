import './styles.css'
import { Providers } from '@/components/Providers'
import { Header } from '@/components/Header'

export const metadata = { title: 'E-Ticaret', description: 'Çok satıcılı pazaryeri' }

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <Providers>
          <Header />
          <main className="container">{children}</main>
        </Providers>
      </body>
    </html>
  )
}