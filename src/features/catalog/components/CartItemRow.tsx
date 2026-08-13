import type { CartItem } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { TrashIcon } from '@phosphor-icons/react'

interface Props {
  item: CartItem
  onDecrement: () => void
  onIncrement: () => void
  onRemove: () => void
}

/** Fila individual de un item del carrito lateral */
export function CartItemRow({ item, onDecrement, onIncrement, onRemove }: Props) {
  return (
    <div className="bg-white border border-gray-200/80 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 shadow-xs hover:border-gray-300 transition-all duration-200 tabular-nums">
      <div className="flex-1 min-w-0 text-left">
        <div className="font-bold text-gray-900 text-sm sm:text-base leading-tight truncate">
          {item.name}
          {item.taxRate === 0 && <span className="opacity-60 text-xs font-normal ml-1">(E)</span>}
        </div>
        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 font-medium mt-0.5">
          {item.defaultCode && <span>{item.defaultCode}</span>}
          {item.defaultCode && <span>•</span>}
          <span className="text-emerald-600 font-semibold">{formatBs(item.price)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-full">
          <button
            type="button"
            className="w-9 h-9 rounded-full bg-white text-gray-800 font-bold text-base shadow-xs flex items-center justify-center active:scale-95 transition-transform select-none cursor-pointer"
            onClick={onDecrement}
          >
            −
          </button>
          <span className="font-extrabold text-sm sm:text-base min-w-[20px] text-center tabular-nums">
            {item.qty}
          </span>
          <button
            type="button"
            className="w-9 h-9 rounded-full bg-white text-gray-800 font-bold text-base shadow-xs flex items-center justify-center active:scale-95 transition-transform select-none cursor-pointer"
            onClick={onIncrement}
          >
            +
          </button>
        </div>

        <div className="text-right min-w-[100px] flex flex-col items-end gap-0.5">
          <span className="font-bold text-sm sm:text-base text-gray-900 tabular-nums leading-tight whitespace-nowrap">
            {formatBs(item.subtotal)}
          </span>
          <span className="text-xs sm:text-sm text-gray-500 font-semibold tabular-nums leading-tight whitespace-nowrap">
            {formatUSD(item.priceUsd * item.qty)}
          </span>
        </div>

        <button
          type="button"
          className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all select-none cursor-pointer"
          onClick={onRemove}
          aria-label="Eliminar"
        >
          <TrashIcon size={18} />
        </button>
      </div>
    </div>
  )
}
