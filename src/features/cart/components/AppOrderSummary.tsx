import type { KioskOrder } from '@/shared/types/types'
import styles from './AppOrderSummary.module.css'

interface Props {
  order: KioskOrder
  showTotal?: boolean
}

export function AppOrderSummary({ order, showTotal = true }: Props) {
  const lines = order.lines ?? []

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
              <td>{line.priceUnit.toFixed(2)}</td>
              <td>{line.priceSubtotal.toFixed(2)}</td>
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
          <span className={styles.totalAmount}>{order.amountTotal.toFixed(2)}</span>
        </div>
      )}
    </div>
  )
}
