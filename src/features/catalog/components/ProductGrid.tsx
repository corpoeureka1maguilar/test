import type { KioskProduct } from '@/shared/types/types'
import { ProductCard } from './ProductCard'

interface Props {
  isLoading: boolean
  filtered: KioskProduct[]
  getQty: (productId: number) => number
  setQty: (productId: number, qty: number) => void
  removeItem: (productId: number) => void
  handleAddItem: (product: KioskProduct) => void
  lastScannedProduct: KioskProduct | null
  setLastScannedProduct: (product: KioskProduct | null) => void
}

/** Listado / Grid de búsqueda manual, con estados de carga y vacío */
export function ProductGrid({
  isLoading,
  filtered,
  getQty,
  setQty,
  removeItem,
  handleAddItem,
  lastScannedProduct,
  setLastScannedProduct
}: Props) {
  if (isLoading) {
    return <p className="col-span-full text-center text-gray-400 font-medium py-12 text-base">Cargando catálogo...</p>
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 overflow-y-auto pb-4 flex-1 min-h-0 pr-1">
      {filtered.map(product => {
        const qty = getQty(product.id)
        return (
          <ProductCard
            key={product.id}
            product={product}
            qty={qty}
            onAdd={handleAddItem}
            onDecrement={() => {
              if (qty > 1) {
                setQty(product.id, qty - 1)
              } else {
                removeItem(product.id)
                if (lastScannedProduct?.id === product.id) {
                  setLastScannedProduct(null)
                }
              }
            }}
            onIncrement={() => handleAddItem(product)}
          />
        )
      })}
      {filtered.length === 0 && (
        <p className="col-span-full text-center text-gray-400 font-medium py-12 text-base">
          No se encontraron productos
        </p>
      )}
    </div>
  )
}
