// src/lib/slug.ts
// Türkçe karakterleri sadeleştirip URL dostu slug üretir.
export function slugify(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
    .replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
export const withSuffix = (slug: string) => `${slug}-${Math.random().toString(36).slice(2, 6)}`