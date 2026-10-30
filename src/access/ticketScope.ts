import type { PayloadRequest } from 'payload'

export async function getOwnTicketIds(req: PayloadRequest): Promise<string[]> {
  if (!req.user) return []

  const tickets = await req.payload.find({
    collection: 'tickets',
    where: { customer: { equals: req.user.id } },
    pagination: false,
    depth: 0,
  })

  return tickets.docs.map((t) => String(t.id))
}