import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

const SEP = '|||'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params
    const decoded = decodeURIComponent(filename)
    const payload = await getPayload({ config })

    const res = await payload.find({
      collection: 'media',
      where: {
        filename: { equals: decoded },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const doc = res.docs[0]
    if (!doc) {
      return new NextResponse('Görsel bulunamadı', { status: 404 })
    }

    const rawAlt = String(doc.alt || '')
    if (rawAlt.includes(SEP)) {
      const b64DataUrl = rawAlt.split(SEP)[1]
      const match = b64DataUrl.match(/^data:(.+?);base64,(.+)$/)
      if (match) {
        const mimeType = match[1]
        const buffer = Buffer.from(match[2], 'base64')
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      }
    }

    return new NextResponse('Görsel verisi yok', { status: 404 })
  } catch (err) {
    console.error('Media file serve error:', err)
    return new NextResponse('Sunucu hatası', { status: 500 })
  }
}
