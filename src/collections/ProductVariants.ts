// src/collections/ProductVariants.ts
import type { CollectionConfig } from 'payload'
import { getOwnProductIds } from '../access/sellerScope'

export const ProductVariants: CollectionConfig = {
    slug: 'product-variants',
    admin: {
        useAsTitle: 'sku',
        hidden: ({ user }) => user?.role === 'support',
    },
    access: {
        read: () => true, // fiyat/stok vitrinde görünmeli
        create: async ({ req, data }) => {
            if (req.user?.role === 'admin') return true
            if (req.user?.role === 'seller') {
                const productIds = await getOwnProductIds(req)
                return productIds.includes(String(data?.product))
            }
            return false
        },
        update: async ({ req }) => {
            if (req.user?.role === 'admin') return true
            if (req.user?.role === 'seller') {
                const productIds = await getOwnProductIds(req)
                if (productIds.length === 0) return false
                return { product: { in: productIds } }
            }
            return false
        },
        delete: ({ req: { user } }) => user?.role === 'admin',
    },
    hooks: {
        beforeValidate: [
            ({ operation, data, req }) => {
                // Satıcı başlangıç stoğunu doğrudan yazamaz; stok girişi log ile yapılır.
                if (operation === 'create' && req.user?.role === 'seller') {
                    return { ...data, stock: 0 }
                }
                return data
            },
        ],
    },
    fields: [
        { 
            name: 'product', 
            type: 'relationship', 
            relationTo: 'products', 
            required: true, 
            index: true 
        },
        { 
            name: 'sku', 
            type: 'text', 
            required: true, 
            unique: true, 
            index: true 
        },
        { 
            name: 'barcode', 
            type: 'text'
        },
        {
            name: 'price',
            type: 'number',
            required: true,
            min: 0,
            admin: { description: 'Kuruş cinsinden tam sayı (örn: 25000 = 250.00 TL). Ondalık YOK.' },
            validate: (value: unknown) => {
                if (typeof value !== 'number' || !Number.isInteger(value)) {
                    return 'Fiyat tam sayı (kuruş) olmalı.'
                }
                return true
            },
        },
        {
            name: 'stock',
            type: 'number',
            required: true,
            defaultValue: 0,
            min: 0,
            // Stok sadece Inventory Logs üzerinden değişir (denetim izi). Doğrudan düzenleme kapalı.
            access: { update: () => false },
            admin: { description: 'Stok girişi için Inventory Logs kullanın.' },
        },
        {
            name: 'options',
            type: 'json',
            admin: { description: 'Örn: {"renk":"Siyah","beden":"42"}' },
        },
    ],
}