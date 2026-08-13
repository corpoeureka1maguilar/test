import type { KioskProduct } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'

interface Props {
  product: KioskProduct
  qty: number
  onAdd: (product: KioskProduct) => void
  onDecrement: () => void
  onIncrement: () => void
}

/** Card individual de producto en la grilla de búsqueda manual */
export function ProductCard({ product, qty, onAdd, onDecrement, onIncrement }: Props) {
  return (
    <div
      className={`bg-white border border-gray-200/90 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between text-center shadow-xs hover:border-emerald-500 hover:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer min-h-[200px] sm:min-h-[220px] select-none ${qty > 0 ? 'border-emerald-500 ring-2 ring-emerald-500/20' : ''}`}
      onClick={() => onAdd(product)}
    >
      <div>
        {product.defaultCode && <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">{product.defaultCode}</span>}
        <h4 className="text-sm sm:text-base font-bold text-gray-900 line-clamp-2 leading-snug my-1.5">
          {product.name}
          {product.taxRate === 0 && <span className="opacity-60 text-xs font-normal ml-1">(E)</span>}
        </h4>
      </div>

      <div onClick={(e) => e.stopPropagation()} className="mt-1">
        <span className="text-lg sm:text-xl font-black text-emerald-600 tabular-nums block">{formatBs(product.price)}</span>
        <span className="block text-xs sm:text-sm font-medium text-gray-400 tabular-nums mb-2.5">{formatUSD(product.priceUsd)}</span>

        {qty === 0 ? (
          <button
            type="button"
            className="w-full h-11 rounded-xl bg-gray-900 text-white font-bold text-sm sm:text-base hover:bg-gray-800 active:scale-95 transition-all shadow-xs cursor-pointer"
            onClick={() => onAdd(product)}
          >
            + Agregar
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 bg-gray-100 p-1 rounded-full">
            <button
              type="button"
              className="w-9 h-9 rounded-full bg-white text-gray-800 font-bold text-base shadow-xs flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
              onClick={onDecrement}
            >
              −
            </button>
            <span className="font-extrabold text-sm sm:text-base min-w-[22px] text-center tabular-nums">{qty}</span>
            <button
              type="button"
              className="w-9 h-9 rounded-full bg-white text-gray-800 font-bold text-base shadow-xs flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
              onClick={onIncrement}
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
