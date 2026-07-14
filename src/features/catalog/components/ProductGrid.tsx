import type { KioskProduct } from '@/shared/types/types'
import { ProductCard } from './ProductCard'
import styles from '../pages/ProductCatalog.module.css'

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
    return <p className={styles.loading}>Cargando catálogo...</p>
  }

  return (
    <div className={styles.grid}>
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
      {filtered.length === 0 && <p className={styles.empty}>No se encontraron productos</p>}
    </div>
  )
}
