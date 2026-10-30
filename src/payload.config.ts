import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'

import { Categories } from './collections/Categories'
import { Sellers } from './collections/Sellers'
import { Products } from './collections/Products'
import { ProductVariants } from './collections/ProductVariants'

import { Carts } from './collections/Carts'
import { CartItems } from './collections/CartItems'
import { Coupons } from './collections/Coupons'

import { Addresses } from './collections/Addresses'
import { Orders } from './collections/Orders'
import { OrderItems } from './collections/OrderItems'
import { Payments } from './collections/Payments'

import { Shipments } from './collections/Shipments'
import { RefundRequests } from './collections/RefundRequests'

import { Tickets } from './collections/Tickets'
import { TicketMessages } from './collections/TicketMessages'
import { InventoryLogs } from './collections/InventoryLogs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, 
                Media, 
                Categories, 
                Sellers, 
                Products, 
                ProductVariants, 
                Carts, CartItems, 
                Coupons, 
                Addresses, 
                Orders, 
                OrderItems, 
                Payments, 
                Shipments, 
                RefundRequests,
                Tickets, 
                TicketMessages,
                InventoryLogs, ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    idType: 'uuid',
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  sharp,
  plugins: [],
})
