import { useState } from 'react'
import { useCartStore } from '@/features/cart/stores/cart'
import { useConfigStore } from '@/shared/stores/config'
import { useUIStore } from '@/shared/stores/ui'
import type { KioskProduct } from '@/shared/types/types'

/**
 * Interacciones del carrito desde el catálogo: agregar productos (con el
 * flujo especial de tarjeta de regalo), auto-agregar productos fijos, la
 * animación de "bounce" del carrito y el helper de cantidad por producto.
 */
export function useCatalogCart(products: KioskProduct[]) {
  const { items, addItem, setQty, removeItem } = useCartStore()
  const fixedProductIds = useConfigStore((s) => s.fixedProductIds) || []
  const giftCardProductId = useConfigStore((s) => s.giftCardProductId)
  const addGiftCard = useCartStore((s) => s.addGiftCard)
  const pushToast = useUIStore((s) => s.pushToast)

  // New visual states for high-end barcode scanner flow
  const [lastScannedProduct, setLastScannedProduct] = useState<KioskProduct | null>(null)
  const [isBouncing, setIsBouncing] = useState(false)

  const [showGiftCardModal, setShowGiftCardModal] = useState(false)
  const [giftCardAmountStr, setGiftCardAmountStr] = useState('')
  const [pendingGiftCardProduct, setPendingGiftCardProduct] = useState<KioskProduct | null>(null)

  const triggerCartAnimation = () => {
    setIsBouncing(true)
    setTimeout(() => setIsBouncing(false), 500)
  }

  const handleAddItem = (product: KioskProduct) => {
    const isGiftCard = product.isGiftCard || product.id === giftCardProductId

    // Si ya hay una tarjeta de regalo en el carrito, bloquear la adición de otros productos
    if (items.some(i => i.isGiftCard)) {
      if (!isGiftCard) {
        pushToast('error', 'No podés combinar otros productos con la compra de una tarjeta de regalo.')
        return
      }
    }

    if (isGiftCard) {
      setPendingGiftCardProduct(product)
      setGiftCardAmountStr('')
      setShowGiftCardModal(true)
      return
    }

    addItem(product)
    setLastScannedProduct(product) // Store as last scanned for easy visual editing
    triggerCartAnimation()

    // Auto-agregar productos fijos si no están ya en el carrito.
    // Leer el estado fresco del store: el closure `items` es anterior al addItem
    // y duplicaría el fijo cuando el producto agregado ES el fijo.
    if (fixedProductIds.length > 0) {
      const currentItems = useCartStore.getState().items
      fixedProductIds.forEach((fixedId: number) => {
        const isAlreadyInCart = currentItems.some(item => item.productId === fixedId)
        if (!isAlreadyInCart) {
          const fixedProduct = products.find(p => p.id === fixedId)
          if (fixedProduct) {
            addItem(fixedProduct)
          }
        }
      })
    }
  }

  const handleGiftCardConfirm = () => {
    const amount = parseFloat(giftCardAmountStr)
    if (isNaN(amount) || amount <= 0) {
      pushToast('error', 'Ingresá un monto válido para la tarjeta de regalo.')
      return
    }
    if (pendingGiftCardProduct) {
      if (items.length > 0 && !items.every(i => i.productId === pendingGiftCardProduct.id)) {
        pushToast('info', 'Se vació el carrito para comprar la tarjeta de regalo.')
      }
      addGiftCard(pendingGiftCardProduct, amount)
      setLastScannedProduct({ ...pendingGiftCardProduct, price: amount, priceUsd: amount })
      triggerCartAnimation()
      setShowGiftCardModal(false)
      setPendingGiftCardProduct(null)
    }
  }

  const getQty = (productId: number) =>
    items.find(i => i.productId === productId)?.qty ?? 0

  return {
    items,
    setQty,
    removeItem,
    lastScannedProduct,
    setLastScannedProduct,
    isBouncing,
    showGiftCardModal,
    setShowGiftCardModal,
    giftCardAmountStr,
    setGiftCardAmountStr,
    pendingGiftCardProduct,
    setPendingGiftCardProduct,
    handleAddItem,
    handleGiftCardConfirm,
    getQty
  }
}
