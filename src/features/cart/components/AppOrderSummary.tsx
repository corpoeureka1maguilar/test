import type { KioskOrder } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'

interface SelectionEntry {
  checked: boolean
  qty: number
}

interface Props {
  order: KioskOrder
  showTotal?: boolean
  // Modo devolución parcial: agrega checkbox + stepper de cantidad por línea.
  // Opcionales y sin default para no afectar a ReprintTab, que reusa este
  // componente en modo solo-lectura
  selectable?: boolean
  selection?: Record<number, SelectionEntry>
  onToggleLine?: (lineId: number) => void
  onQtyChange?: (lineId: number, qty: number) => void
  // Total de lo seleccionado; si no se pasa, se usa order.amountTotal (todo)
  totalOverride?: number
}

// Clases reutilizadas por celdas de encabezado y de cuerpo (antes .table th, .table td)
const thClass = 'p-4 px-5 text-left border-b border-[#eee] font-bold bg-[#f8f8f8] text-[1.05rem] uppercase tracking-[0.05em] last:text-right'
const tdClass = 'p-4 px-5 text-left border-b border-[#eee] last:text-right text-[1.15rem]'
const stepperBtnClass = 'w-10 h-10 border-none rounded-full bg-surface-heavy text-text text-[1.2rem] font-light cursor-pointer font-app flex items-center justify-center transition-[transform,background-color] duration-200 [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)] shadow-[0_2px_6px_rgba(0,0,0,0.05)] active:scale-[0.96] active:bg-surface-hover'

export function AppOrderSummary({ order, showTotal = true, selectable = false, selection, onToggleLine, onQtyChange, totalOverride }: Props) {
  const lines = order.lines ?? []
  const currentRate = useExchangeRateStore((s) => s.rate)

  // Los montos de Odoo vienen en USD; los Bs se reconstruyen con la tasa
  // histórica de la orden para calzar con la factura fiscal original
  const rate = order.rate || currentRate
  const total = totalOverride ?? order.amountTotal

  return (
    <div className="w-full">
      <table className="w-full border-collapse text-lg table-fixed">
        <colgroup>
          {selectable && <col className="w-14" />}
          <col />
          <col className="w-[10rem]" />
          {selectable && <col className="w-[7.5rem]" />}
          <col className="w-[11rem]" />
        </colgroup>
        <thead>
          <tr>
            {selectable && <th className={thClass}></th>}
            <th className={thClass}>Producto</th>
            <th className={`${thClass} text-center`}>Cant.</th>
            {selectable && <th className={`${thClass} text-center`}>Devuelto</th>}
            <th className={thClass}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const entry = selection?.[line.id]
            // Lo ya devuelto no se puede volver a devolver: el tope del stepper
            // es lo que queda de la línea, no la cantidad original del pedido
            const returnedQty = line.returnedQty ?? 0
            const availableQty = line.productUomQty - returnedQty
            return (
              <tr key={line.id}>
                {selectable && (
                  <td className={tdClass}>
                    <input
                      type="checkbox"
                      className="w-6 h-6 cursor-pointer"
                      checked={entry?.checked ?? false}
                      disabled={availableQty <= 0}
                      onChange={() => onToggleLine?.(line.id)}
                    />
                  </td>
                )}
                <td className={tdClass}>{line.productId[1]}</td>
                <td className={`${tdClass} text-center`}>
                  {selectable ? (
                    <div className="inline-flex items-center gap-2 bg-white p-1 rounded-[50px]">
                      <button
                        type="button"
                        className={stepperBtnClass}
                        disabled={!entry?.checked}
                        onClick={() => onQtyChange?.(line.id, (entry?.qty ?? 1) - 1)}
                      >−</button>
                      <span className="text-[1.2rem] font-semibold min-w-[2.2rem] text-center tabular-nums">{entry?.qty ?? 0}</span>
                      <button
                        type="button"
                        className={stepperBtnClass}
                        disabled={!entry?.checked || (entry?.qty ?? 0) >= availableQty}
                        onClick={() => onQtyChange?.(line.id, (entry?.qty ?? 0) + 1)}
                      >+</button>
                    </div>
                  ) : (
                    line.productUomQty
                  )}
                </td>
                {selectable && (
                  <td className={`${tdClass} text-center`}>
                    <span
                      className={
                        returnedQty > 0
                          ? 'inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[0.9rem] font-semibold tabular-nums'
                          : 'text-text-muted tabular-nums'
                      }
                    >
                      {returnedQty}
                    </span>
                  </td>
                )}
                <td className={`${tdClass} font-bold tabular-nums`}>
                  {formatBs(line.priceSubtotal * rate)}
                  <span className="block text-[0.65em] text-text-muted font-normal tracking-[0.01em] mt-1 tabular-nums">{formatUSD(line.priceSubtotal)}</span>
                </td>
              </tr>
            )
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan={selectable ? 5 : 3} className="!text-center text-[#999] !p-8">Sin líneas</td>
            </tr>
          )}
        </tbody>
      </table>
      {showTotal && (
        <div className="flex justify-between items-center p-5 border-t-[3px] border-black text-[1.5rem] font-bold mt-2">
          <span>Total</span>
          <span className="text-[2.2rem] text-end tabular-nums">{formatBs(total * rate)}<span className="block text-[0.7em] text-text-muted font-normal tracking-[0.01em] mt-1 tabular-nums text-end">{formatUSD(total)}</span></span>
        </div>
      )}
    </div>
  )
}
