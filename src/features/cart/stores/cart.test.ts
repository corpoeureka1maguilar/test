import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCartStore, useCartTotal, useCartTaxTotal, useCartCount } from './cart'
import type { KioskProduct } from '@/shared/types/types'

function makeProduct(overrides: Partial<KioskProduct> = {}): KioskProduct {
  return {
    id: 1,
    name: 'Producto A',
    defaultCode: 'P-A',
    price: 100,
    priceUsd: 10,
    taxRate: 0.16,
    categId: 1,
    categName: 'General',
    uomName: 'Unidad',
    ...overrides
  }
}

beforeEach(() => {
  useCartStore.getState().clearCart()
})

describe('useCartStore', () => {
  it('adds a new item to the cart', () => {
    act(() => useCartStore.getState().addItem(makeProduct()))
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].qty).toBe(1)
  })

  it('increments quantity and recalculates subtotal when adding the same product again', () => {
    act(() => {
      useCartStore.getState().addItem(makeProduct())
      useCartStore.getState().addItem(makeProduct())
    })
    const item = useCartStore.getState().items[0]
    expect(item.qty).toBe(2)
    expect(item.subtotal).toBe(200)
  })

  it('sets the quantity of an existing item and recalculates its subtotal', () => {
    act(() => useCartStore.getState().addItem(makeProduct()))
    act(() => useCartStore.getState().setQty(1, 3))
    const item = useCartStore.getState().items[0]
    expect(item.qty).toBe(3)
    expect(item.subtotal).toBe(300)
  })

  it('ignores setQty when the quantity is zero or negative', () => {
    act(() => useCartStore.getState().addItem(makeProduct()))
    act(() => useCartStore.getState().setQty(1, 0))
    expect(useCartStore.getState().items[0].qty).toBe(1)
  })

  it('removes an item from the cart', () => {
    act(() => useCartStore.getState().addItem(makeProduct()))
    act(() => useCartStore.getState().removeItem(1))
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('clears the cart', () => {
    act(() => useCartStore.getState().addItem(makeProduct()))
    act(() => useCartStore.getState().clearCart())
    expect(useCartStore.getState().items).toHaveLength(0)
  })
})

describe('cart totals', () => {
  it('sums the subtotal of all items', () => {
    act(() => {
      useCartStore.getState().addItem(makeProduct({ id: 1, price: 100 }))
      useCartStore.getState().addItem(makeProduct({ id: 2, price: 50 }))
    })
    const { result } = renderHook(() => useCartTotal())
    expect(result.current).toBe(150)
  })

  it('extracts the tax portion already included in each subtotal', () => {
    act(() => useCartStore.getState().addItem(makeProduct({ price: 116, taxRate: 0.16 })))
    const { result } = renderHook(() => useCartTaxTotal())
    expect(result.current).toBeCloseTo(16, 5)
  })

  it('counts total units across items', () => {
    act(() => {
      useCartStore.getState().addItem(makeProduct({ id: 1 }))
      useCartStore.getState().setQty(1, 4)
      useCartStore.getState().addItem(makeProduct({ id: 2 }))
    })
    const { result } = renderHook(() => useCartCount())
    expect(result.current).toBe(5)
  })
})
