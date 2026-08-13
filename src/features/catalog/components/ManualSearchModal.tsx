import type { RefObject } from 'react'
import type { KioskProduct } from '@/shared/types/types'
import type { ProductCategory } from '../hooks/useProductFilters'
import { ProductGrid } from './ProductGrid'

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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[1000] p-4 sm:p-6 animate-fadeIn" onClick={onClose}>
      <div className="bg-white w-full max-w-7xl h-[95vh] rounded-3xl border border-gray-200 shadow-2xl flex flex-col p-4 sm:p-6 relative overflow-hidden animate-scaleIn" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0 gap-4">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 m-0">
            Búsqueda Manual de Productos
          </h2>
          <button
            type="button"
            className="bg-red-500 hover:bg-red-600 text-white font-bold text-base px-6 py-2 rounded-full transition-all duration-200 active:scale-95 cursor-pointer shadow-md select-none"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        {/* Input de búsqueda */}
        <div className="mb-3 shrink-0">
          <input
            ref={searchRef}
            type="text"
            className="w-full h-12 sm:h-13 px-4 font-semibold text-base sm:text-lg bg-gray-100 border border-gray-200 rounded-2xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all"
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

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Filtros de Categorías */}
          <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none shrink-0 mb-3">
            <button
              key="all"
              type="button"
              className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200 active:scale-95 transition-all select-none cursor-pointer min-h-[38px] ${activeCategoryId === null ? 'bg-gray-900 text-white hover:bg-gray-800' : ''}`}
              onClick={() => setActiveCategoryId(null)}
            >
              Todos
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                type="button"
                className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200 active:scale-95 transition-all select-none cursor-pointer min-h-[38px] ${activeCategoryId === c.id ? 'bg-gray-900 text-white hover:bg-gray-800' : ''}`}
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
