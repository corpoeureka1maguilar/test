import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { useMemo } from 'react'
import type { CartItem, KioskProduct } from '@/shared/types/types'
import { ves, addVES, toFloat, mulVES, type VESDinero } from '@/shared/lib/money'

interface CartState {
  items: CartItem[]
}

interface CartActions {
  addItem(product: KioskProduct): void
  addGiftCard(product: KioskProduct, amount: number): void
  removeItem(productId: number): void
  setQty(productId: number, qty: number): void
  clearCart(): void
}

// Persistido para que una compra no finalizada sobreviva recargas del kiosco;
// solo se vacía con clearCart() tras un pago exitoso
export const useCartStore = create<CartState & CartActions>()(devtools(persist((set) => ({
  items: [],

  addItem(product) {
    set((s) => {
      // Bloquear si ya hay una tarjeta de regalo en el carrito
      if (s.items.some(i => i.isGiftCard)) {
        return {}
      }
      const existing = s.items.find(i => i.productId === product.id)
      if (existing) {
        return {
          items: s.items.map(i =>
            i.productId === product.id
              ? { ...i, qty: i.qty + 1, subtotal: toFloat(mulVES(ves(i.price), i.qty + 1)) }
              : i
          )
        }
      }
      return {
        items: [...s.items, {
          productId: product.id,
          name: product.name,
          defaultCode: product.defaultCode,
          price: product.price,
          priceUsd: product.priceUsd,
          taxRate: product.taxRate,
          qty: 1,
          subtotal: product.price,
          isGiftCard: product.isGiftCard
        }]
      }
    })
  },

  addGiftCard(product, amount) {
    set(() => {
      // Comprar tarjeta de regalo reemplaza todo el carrito (debe contenerla solo a ella)
      return {
        items: [{
          productId: product.id,
          name: product.name,
          defaultCode: product.defaultCode,
          price: amount,
          priceUsd: amount,
          taxRate: product.taxRate,
          qty: 1,
          subtotal: amount,
          isGiftCard: true
        }]
      }
    })
  },

  removeItem(productId) {
    set((s) => ({ items: s.items.filter(i => i.productId !== productId) }))
  },

  setQty(productId, qty) {
    if (qty <= 0) {
      return;
    } else {
      set((s) => ({
        items: s.items.map(i =>
          i.productId === productId
            ? { ...i, qty, subtotal: toFloat(mulVES(ves(i.price), qty)) }
            : i
        )
      }))
    }
  },

  clearCart() {
    set({ items: [] })
  }
}), { name: 'autopay-cart' }), { name: 'cart' }))

export function useCartSubtotal() {
  return useCartStore(s => {
    const subtotalD = s.items.reduce<VESDinero>((sumD, i) => addVES(sumD, ves(i.subtotal)), ves(0))
    return toFloat(subtotalD)
  })
}

export function useCartTotal() {
  return useCartStore(s => {
    const totalD = s.items.reduce<VESDinero>(
      (sumD, i) => addVES(sumD, ves(i.subtotal * (1 + i.taxRate))),
      ves(0)
    )
    return toFloat(totalD)
  })
}

export function useCartTaxTotal() {
  return useCartStore(s => {
    const taxD = s.items.reduce<VESDinero>(
      (sumD, i) => addVES(sumD, ves(i.subtotal * i.taxRate)),
      ves(0)
    )
    return toFloat(taxD)
  })
}

export interface CartTaxBreakdownItem {
  rate: number
  label: string
  amount: number
}

export function useCartTaxBreakdown(): CartTaxBreakdownItem[] {
  const items = useCartStore(s => s.items)
  return useMemo(() => {
    const baseByRate: Record<number, number> = {}
    const taxByRate: Record<number, number> = {}

    for (const item of items) {
      const rate = item.taxRate ?? 0
      baseByRate[rate] = toFloat(addVES(ves(baseByRate[rate] ?? 0), ves(item.subtotal)))
      taxByRate[rate] = toFloat(addVES(ves(taxByRate[rate] ?? 0), ves(item.subtotal * rate)))
    }

    return Object.keys(baseByRate).map((rateStr) => {
      const rate = parseFloat(rateStr)
      let label = `IVA (${(rate * 100).toFixed(0)}%)`
      if (rate === 0) {
        label = 'Exento'
      } else if (rate === 0.16) {
        label = 'IVA General (16%)'
      } else if (rate === 0.15) {
        label = 'IVA (15%)'
      } else if (rate === 0.31) {
        label = 'IVA Importado (31%)'
      }
      // El tramo Exento no tiene impuesto que mostrar (es 0 por definición);
      // lo que interesa ahí es la base exenta, no el impuesto generado
      const amount = rate === 0 ? baseByRate[rate] : taxByRate[rate]
      return { rate, label, amount }
    }).sort((a, b) => b.rate - a.rate)
  }, [items])
}

export function useCartCount() {
  return useCartStore(s => s.items.reduce((sum, i) => sum + i.qty, 0))
}
