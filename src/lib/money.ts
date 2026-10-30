// Veritabanında kuruş (integer) tutuyoruz; ekranda TL olarak gösteriyoruz.
export const formatTRY = (kurus: number) =>
  (kurus / 100).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })