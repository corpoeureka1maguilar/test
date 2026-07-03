import type { KioskOrder } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import styles from './AppOrderSummary.module.css'

interface Props {
  order: KioskOrder
  showTotal?: boolean
}

export function AppOrderSummary({ order, showTotal = true }: Props) {
  const lines = order.lines ?? []
  const currentRate = useExchangeRateStore((s) => s.rate)

  // Los montos de Odoo vienen en USD; los Bs se reconstruyen con la tasa
  // histórica de la orden para calzar con la factura fiscal original
  const rate = order.rate || currentRate

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Cant.</th>
            <th>P. Unit.</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>{line.productId[1]}</td>
              <td>{line.productUomQty}</td>
              <td>{formatBs(line.priceUnit * rate)}<span className={styles.amountUsd}>{formatUSD(line.priceUnit)}</span></td>
              <td>{formatBs(line.priceSubtotal * rate)}<span className={styles.amountUsd}>{formatUSD(line.priceSubtotal)}</span></td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={4} className={styles.empty}>Sin líneas</td>
            </tr>
          )}
        </tbody>
      </table>
      {showTotal && (
        <div className={styles.total}>
          <span>Total</span>
          <span className={styles.totalAmount}>{formatBs(order.amountTotal * rate)}<span className={styles.amountUsd}>{formatUSD(order.amountTotal)}</span></span>
        </div>
      )}
    </div>
  )
}
