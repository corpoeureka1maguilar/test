import { create } from 'zustand'
import type { CartItem, KioskProduct } from '@/shared/types/types'

interface CartState {
  items: CartItem[]
}

interface CartActions {
  addItem(product: KioskProduct): void
  removeItem(productId: number): void
  setQty(productId: number, qty: number): void
  clearCart(): void
}

export const useCartStore = create<CartState & CartActions>((set) => ({
  items: [],

  addItem(product) {
    set((s) => {
      const existing = s.items.find(i => i.productId === product.id)
      if (existing) {
        return {
          items: s.items.map(i =>
            i.productId === product.id
              ? { ...i, qty: i.qty + 1, subtotal: (i.qty + 1) * i.price }
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
          qty: 1,
          subtotal: product.price
        }]
      }
    })
  },

  removeItem(productId) {
    set((s) => ({ items: s.items.filter(i => i.productId !== productId) }))
  },

  setQty(productId, qty) {
    if (qty <= 0) {
      set((s) => ({ items: s.items.filter(i => i.productId !== productId) }))
    } else {
      set((s) => ({
        items: s.items.map(i =>
          i.productId === productId
            ? { ...i, qty, subtotal: qty * i.price }
            : i
        )
      }))
    }
  },

  clearCart() {
    set({ items: [] })
  }
}))

export function useCartTotal() {
  return useCartStore(s => s.items.reduce((sum, i) => sum + i.subtotal, 0))
}

export function useCartCount() {
  return useCartStore(s => s.items.reduce((sum, i) => sum + i.qty, 0))
}
