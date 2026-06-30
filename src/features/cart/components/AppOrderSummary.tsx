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
  const rate = useExchangeRateStore((s) => s.rate)

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
              <td>{formatBs(line.priceUnit)}{rate > 0 && <span className={styles.amountUsd}>{formatUSD(line.priceUnit / rate)}</span>}</td>
              <td>{formatBs(line.priceSubtotal)}{rate > 0 && <span className={styles.amountUsd}>{formatUSD(line.priceSubtotal / rate)}</span>}</td>
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
          <span className={styles.totalAmount}>{formatBs(order.amountTotal)}{rate > 0 && <span className={styles.amountUsd}>{formatUSD(order.amountTotal / rate)}</span>}</span>
        </div>
      )}
    </div>
  )
}
