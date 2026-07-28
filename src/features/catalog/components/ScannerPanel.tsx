import { BarcodeIcon, Sparkle } from '@phosphor-icons/react'
import type { KioskProduct } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'

interface Props {
  lastScannedProduct: KioskProduct | null
  getQty: (productId: number) => number
  setQty: (productId: number, qty: number) => void
  removeItem: (productId: number) => void
  setLastScannedProduct: (product: KioskProduct | null) => void
}

/** Zona izquierda de operación: lector de código de barras + último producto escaneado */
export function ScannerPanel({ lastScannedProduct, getQty, setQty, removeItem, setLastScannedProduct }: Props) {
  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-5 items-center">
      {/* Zona del Lector de Código de Barras */}
      <div className={`w-full min-h-[160px] p-6 bg-gray-100/80 border-2 border-dashed border-gray-300 rounded-3xl flex flex-col items-center justify-center gap-2 relative overflow-hidden transition-all duration-300 ${lastScannedProduct ? 'border-emerald-500 bg-emerald-50/50 shadow-lg shadow-emerald-500/10' : ''}`}>
        <div className="opacity-40 text-gray-700 animate-pulse">
          <BarcodeIcon size={72} weight="thin" />
        </div>
        <div className="text-lg font-bold text-gray-800 text-center px-4">
          Listo para escanear
        </div>
        <div className="text-sm font-medium text-gray-500">
          Pasa el código de barras de tu producto
        </div>
      </div>

      {/* Visualización Premium del Último Producto Escaneado */}
      {lastScannedProduct && (
        <div className="w-full animate-pop">
          <div className="text-sm font-extrabold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkle size={18} weight="fill" className="text-emerald-500" />
            Último Producto Escaneado
          </div>
          <div className="bg-white border-2 border-emerald-500 rounded-3xl p-5 shadow-xl w-full flex flex-col gap-4 relative tabular-nums">
            <div className="flex justify-between items-start">
              <div className="flex-1 text-left">
                <span className="text-xs text-gray-500 font-semibold">
                  {lastScannedProduct.defaultCode || 'Sin código'}
                </span>
                <h3 className="text-lg font-extrabold text-gray-900 leading-tight mt-0.5">
                  {lastScannedProduct.name}
                  {lastScannedProduct.taxRate === 0 && <span className="opacity-60 text-xs font-normal ml-1">(E)</span>}
                </h3>
              </div>
              <div className="text-right flex flex-col items-end tabular-nums">
                <span className="text-xl font-black text-emerald-600">{formatBs(lastScannedProduct.price)}</span>
                <span className="text-xs text-gray-400 font-medium">{formatUSD(lastScannedProduct.priceUsd)}</span>
                <span className="text-xs text-gray-500 font-normal">
                  por {lastScannedProduct.uomName || 'unidad'}
                </span>
              </div>
            </div>

            {/* Control rápido de cantidad */}
            <div className="flex items-center justify-between bg-gray-100 p-3 px-5 rounded-full" onClick={(e) => e.stopPropagation()}>
              <span className="font-bold text-gray-900 text-base">
                Cantidad:
              </span>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="w-10 h-10 rounded-full bg-white text-gray-800 font-bold text-lg shadow-xs flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                  onClick={() => {
                    const qty = getQty(lastScannedProduct.id)
                    if (qty > 1) {
                      setQty(lastScannedProduct.id, qty - 1)
                    } else {
                      removeItem(lastScannedProduct.id)
                      setLastScannedProduct(null)
                    }
                  }}
                >
                  −
                </button>
                <span className="font-extrabold text-lg min-w-[24px] text-center tabular-nums">{getQty(lastScannedProduct.id)}</span>
                <button
                  type="button"
                  className="w-10 h-10 rounded-full bg-white text-gray-800 font-bold text-lg shadow-xs flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                  onClick={() => setQty(lastScannedProduct.id, getQty(lastScannedProduct.id) + 1)}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
