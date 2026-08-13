import type { CartItem, KioskProduct } from '@/shared/types/types'
import type { CartTaxBreakdownItem } from '@/features/cart/stores/cart'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { ShoppingCart } from '@phosphor-icons/react'
import { CartItemRow } from './CartItemRow'

interface Props {
  items: CartItem[]
  count: number
  setQty: (productId: number, qty: number) => void
  removeItem: (productId: number) => void
  lastScannedProduct: KioskProduct | null
  setLastScannedProduct: (product: KioskProduct | null) => void
  subtotal: number
  taxBreakdown: CartTaxBreakdownItem[]
  total: number
  rate: number
  isBouncing: boolean
  onCancel: () => void
  onCheckout: () => void
}

/** Carrito lateral integrado: listado de items, desglose de totales y acciones */
export function CartSidebar({
  items,
  count,
  setQty,
  removeItem,
  lastScannedProduct,
  setLastScannedProduct,
  subtotal,
  taxBreakdown,
  total,
  rate,
  isBouncing,
  onCancel,
  onCheckout
}: Props) {
  return (
    <div className="bg-white/95 backdrop-blur-xl border border-gray-200 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-start max-h-full w-full max-w-full box-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200/80 pb-3 mb-3.5 shrink-0 gap-4">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-3 m-0">
          Tu Compra
        </h2>
        <span className="bg-gray-900 text-white rounded-full px-4 py-1.5 text-sm font-extrabold tabular-nums shrink-0 whitespace-nowrap shadow-xs">
          {count} {count === 1 ? 'elemento' : 'elementos'}
        </span>
      </div>

      {/* Listado con Scroll de ítems */}
      <div className="p-1 overflow-y-auto flex flex-col gap-2.5 pr-1 mb-3.5 min-h-0 flex-1">
        {items.map(item => (
          <CartItemRow
            key={item.productId}
            item={item}
            onDecrement={() => {
              if (item.qty > 1) {
                setQty(item.productId, item.qty - 1)
              }
            }}
            onIncrement={() => setQty(item.productId, item.qty + 1)}
            onRemove={() => {
              removeItem(item.productId)
              if (lastScannedProduct?.id === item.productId) {
                setLastScannedProduct(null)
              }
            }}
          />
        ))}

        {items.length === 0 && (
          <div className="flex-1 flex flex-col justify-center items-center text-gray-400 text-base gap-2 py-8">
            <ShoppingCart size={64} weight="light" className="text-gray-300 mb-1" />
            <p className="font-semibold text-gray-600 text-lg">Tu carrito está vacío</p>
            <span className="text-sm text-gray-400">
              Escanéa códigos o busca para agregar
            </span>
          </div>
        )}
      </div>

      {/* Desglose de totales en grilla limpia de 2 columnas sin tarjetas ni fondos anidados */}
      <div className="py-2.5 px-2 mb-3 shrink-0 tabular-nums border-t border-b border-gray-200/80 grid grid-cols-2 gap-x-4 gap-y-1.5 items-center text-xs sm:text-sm font-semibold text-gray-500">
        <div className="flex items-center justify-between">
          <span>Subtotal</span>
          <div className="text-right">
            <span className="text-gray-900 font-bold">{formatBs(subtotal)}</span>
            {rate > 0 && <span className="block text-xs text-gray-400 font-medium whitespace-nowrap">{formatUSD(subtotal / rate)}</span>}
          </div>
        </div>

        {taxBreakdown.map((tax) => (
          <div key={tax.rate} className="flex items-center justify-between">
            <span>{tax.label}</span>
            <div className="text-right">
              <span className="text-gray-900 font-bold">{formatBs(tax.amount)}</span>
              {rate > 0 && <span className="block text-xs text-gray-400 font-medium whitespace-nowrap">{formatUSD(tax.amount / rate)}</span>}
            </div>
          </div>
        ))}

        <div className="col-span-2 flex items-center justify-between text-base sm:text-lg font-extrabold text-gray-900 pt-2 border-t border-dashed border-gray-200 mt-1">
          <span>Total</span>
          <div className="text-right">
            <span className="text-xl sm:text-2xl font-black text-emerald-600 leading-none tabular-nums">{formatBs(total)}</span>
            {rate > 0 && <span className="block text-xs font-semibold text-gray-400 mt-0.5">{formatUSD(total / rate)}</span>}
          </div>
        </div>
      </div>

      {/* Acciones principales */}
      <div className="flex gap-3 shrink-0 w-full" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="flex-1 h-13 sm:h-14 rounded-full bg-gray-100 text-gray-800 font-bold text-base sm:text-lg hover:bg-gray-200 active:scale-95 transition-all duration-200 shadow-xs flex items-center justify-center cursor-pointer"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          type="button"
          className={`flex-[2] h-13 sm:h-14 rounded-full bg-emerald-500 text-white font-bold text-lg sm:text-xl hover:bg-emerald-600 active:scale-95 transition-all duration-200 shadow-lg shadow-emerald-500/20 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${isBouncing ? 'animate-bounce' : ''}`}
          onClick={onCheckout}
          disabled={count === 0}
        >
          PAGAR AHORA
        </button>
      </div>
    </div>
  )
}
