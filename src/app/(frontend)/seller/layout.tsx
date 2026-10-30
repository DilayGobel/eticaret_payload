// src/app/(frontend)/seller/layout.tsx
import { SellerGate } from '@/components/SellerGate'

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return <SellerGate>{children}</SellerGate>
}