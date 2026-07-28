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
      className={`bg-white border border-gray-200/90 rounded-2xl p-6 flex flex-col justify-between text-center shadow-xs hover:border-emerald-500 hover:shadow-md active:scale-98 transition-all duration-200 cursor-pointer min-h-[300px] select-none ${qty > 0 ? 'border-emerald-500 ring-2 ring-emerald-500/20' : ''}`}
      onClick={() => onAdd(product)}
    >
      <div>
        {product.defaultCode && <span className="text-sm text-gray-400 font-semibold uppercase tracking-wider block">{product.defaultCode}</span>}
        <h4 className="text-lg font-bold text-gray-900 line-clamp-2 leading-tight my-2.5">
          {product.name}
          {product.taxRate === 0 && <span className="opacity-60 text-sm font-normal ml-1">(E)</span>}
        </h4>
      </div>

      <div onClick={(e) => e.stopPropagation()} className="mt-2">
        <span className="text-2xl font-black text-emerald-600 tabular-nums block">{formatBs(product.price)}</span>
        <span className="block text-base font-medium text-gray-400 tabular-nums mb-4">{formatUSD(product.priceUsd)}</span>

        {qty === 0 ? (
          <button
            type="button"
            className="w-full h-16 rounded-xl bg-gray-900 text-white font-bold text-lg hover:bg-gray-800 active:scale-95 transition-all shadow-xs cursor-pointer"
            onClick={() => onAdd(product)}
          >
            + Agregar
          </button>
        ) : (
          <div className="flex items-center justify-center gap-4 bg-gray-100 p-2 rounded-full">
            <button
              type="button"
              className="w-12 h-12 rounded-full bg-white text-gray-800 font-bold text-xl shadow-xs flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
              onClick={onDecrement}
            >
              −
            </button>
            <span className="font-extrabold text-lg min-w-[28px] text-center tabular-nums">{qty}</span>
            <button
              type="button"
              className="w-12 h-12 rounded-full bg-white text-gray-800 font-bold text-xl shadow-xs flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
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
