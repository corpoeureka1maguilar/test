import type { RefObject } from 'react'
import type { KioskProduct } from '@/shared/types/types'
import type { ProductCategory } from '../hooks/useProductFilters'
import { ProductGrid } from './ProductGrid'
import styles from '../pages/ProductCatalog.module.css'

interface Props {
  searchRef: RefObject<HTMLInputElement>
  search: string
  setSearch: (value: string) => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  setShowKeyboard: (value: boolean) => void
  setIsKeyboardMinimized: (value: boolean) => void
  onClose: () => void
  categories: ProductCategory[]
  activeCategoryId: number | null
  setActiveCategoryId: (id: number | null) => void
  isLoading: boolean
  filtered: KioskProduct[]
  getQty: (productId: number) => number
  setQty: (productId: number, qty: number) => void
  removeItem: (productId: number) => void
  handleAddItem: (product: KioskProduct) => void
  lastScannedProduct: KioskProduct | null
  setLastScannedProduct: (product: KioskProduct | null) => void
}

/** Modal de búsqueda manual de productos: input, filtros de categoría y grid */
export function ManualSearchModal({
  searchRef,
  search,
  setSearch,
  handleKeyDown,
  setShowKeyboard,
  setIsKeyboardMinimized,
  onClose,
  categories,
  activeCategoryId,
  setActiveCategoryId,
  isLoading,
  filtered,
  getQty,
  setQty,
  removeItem,
  handleAddItem,
  lastScannedProduct,
  setLastScannedProduct
}: Props) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Búsqueda Manual de Productos</h2>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        <div className={styles.modalSearchContainer}>
          <input
            ref={searchRef}
            type="text"
            className={styles.search}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setShowKeyboard(true);
              setIsKeyboardMinimized(false);
            }}
            inputMode="none"
            placeholder="Escribí nombre o código de barras..."
            autoComplete="off"
          />
        </div>

        <div className={styles.manualSearchSection}>
          {/* Filtros de Categorías */}
          <div className={styles.categories}>
            <button
              key="all"
              type="button"
              className={`${styles.catBtn} ${activeCategoryId === null ? styles.active : ''}`}
              onClick={() => setActiveCategoryId(null)}
            >
              Todos
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                type="button"
                className={`${styles.catBtn} ${activeCategoryId === c.id ? styles.active : ''}`}
                onClick={() => setActiveCategoryId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Listado / Grid de Búsqueda Manual */}
          <ProductGrid
            isLoading={isLoading}
            filtered={filtered}
            getQty={getQty}
            setQty={setQty}
            removeItem={removeItem}
            handleAddItem={handleAddItem}
            lastScannedProduct={lastScannedProduct}
            setLastScannedProduct={setLastScannedProduct}
          />
        </div>
      </div>
    </div>
  )
}
