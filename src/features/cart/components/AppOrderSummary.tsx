import type { KioskOrder } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'

interface Props {
  order: KioskOrder
  showTotal?: boolean
}

// Clases reutilizadas por celdas de encabezado y de cuerpo (antes .table th, .table td)
const thClass = 'p-3 px-4 text-left border-b border-[#eee] font-bold bg-[#f8f8f8] text-[0.9rem] uppercase tracking-[0.05em] last:text-right'
const tdClass = 'p-3 px-4 text-left border-b border-[#eee] last:text-right'

export function AppOrderSummary({ order, showTotal = true }: Props) {
  const lines = order.lines ?? []
  const currentRate = useExchangeRateStore((s) => s.rate)

  // Los montos de Odoo vienen en USD; los Bs se reconstruyen con la tasa
  // histórica de la orden para calzar con la factura fiscal original
  const rate = order.rate || currentRate

  return (
    <div className="w-full">
      <table className="w-full border-collapse text-base">
        <thead>
          <tr>
            <th className={thClass}>Producto</th>
            <th className={thClass}>Cant.</th>
            <th className={thClass}>P. Unit.</th>
            <th className={thClass}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td className={tdClass}>{line.productId[1]}</td>
              <td className={tdClass}>{line.productUomQty}</td>
              <td className={tdClass}>{formatBs(line.priceUnit * rate)}<span className="block text-[0.75em] text-text-muted font-normal tracking-[0.01em] mt-[0.1em] tabular-nums">{formatUSD(line.priceUnit)}</span></td>
              <td className={tdClass}>{formatBs(line.priceSubtotal * rate)}<span className="block text-[0.75em] text-text-muted font-normal tracking-[0.01em] mt-[0.1em] tabular-nums">{formatUSD(line.priceSubtotal)}</span></td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={4} className="!text-center text-[#999] !p-8">Sin líneas</td>
            </tr>
          )}
        </tbody>
      </table>
      {showTotal && (
        <div className="flex justify-between items-center p-4 border-t-[3px] border-black text-[1.3rem] font-bold mt-2">
          <span>Total</span>
          <span className="text-[1.8rem] text-end">{formatBs(order.amountTotal * rate)}<span className="block text-[0.75em] text-text-muted font-normal tracking-[0.01em] mt-[0.1em] tabular-nums text-end">{formatUSD(order.amountTotal)}</span></span>
        </div>
      )}
    </div>
  )
}
