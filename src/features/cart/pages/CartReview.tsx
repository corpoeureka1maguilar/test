import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useCartStore, useCartTotal, useCartSubtotal, useCartTaxBreakdown } from '@/features/cart/stores/cart'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import styles from './CartReview.module.css'

export function CartReview() {
  const { send } = useSaleMachine()
  const navigate = useNavigate()
  const { items, setQty, removeItem } = useCartStore()
  const total = useCartTotal()
  const subtotal = useCartSubtotal()
  const taxBreakdown = useCartTaxBreakdown()
  const rate = useExchangeRateStore((s) => s.rate)

  const handlePay = () => {
    if (items.length === 0) return
    send({ type: 'PAY' })
    navigate('/pago')
  }

  return (
    <div className="kiosk-container">
      <h2 className={styles.title}>Tu Carrito</h2>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p>Tu carrito está vacío</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/productos')}>
            Ver productos
          </button>
        </div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio</th>
                  <th>Cantidad</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.productId}>
                    <td>
                      <div className={styles.productName}>
                        {item.name}
                        {item.taxRate === 0 && <span style={{ opacity: 0.6, marginLeft: '0.25rem', fontWeight: 'normal' }}>(E)</span>}
                      </div>
                      {item.defaultCode && <div className={styles.code}>{item.defaultCode}</div>}
                    </td>
                    <td>{formatBs(item.price)}<span className={styles.amountUsd}>{formatUSD(item.priceUsd)}</span></td>
                    <td>
                      <div className={styles.qtyControl}>
                        <button type="button" onClick={() => setQty(item.productId, item.qty - 1)}>−</button>
                        <span>{item.qty}</span>
                        <button type="button" onClick={() => setQty(item.productId, item.qty + 1)}>+</button>
                      </div>
                    </td>
                    <td className={styles.subtotal}>{formatBs(item.subtotal)}<span className={styles.amountUsd}>{formatUSD(item.priceUsd * item.qty)}</span></td>
                    <td>
                      <button type="button" className={styles.removeBtn} onClick={() => removeItem(item.productId)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.totalSection}>
            <div className={styles.totalRow}>
              <span>Subtotal</span>
              <span>{formatBs(subtotal)}{rate > 0 && <span className={styles.amountUsd}>{formatUSD(subtotal / rate)}</span>}</span>
            </div>
            {taxBreakdown.map((tax) => (
              <div key={tax.rate} className={styles.totalRow}>
                <span>{tax.label}</span>
                <span>{formatBs(tax.amount)}{rate > 0 && <span className={styles.amountUsd}>{formatUSD(tax.amount / rate)}</span>}</span>
              </div>
            ))}
            <div className={styles.totalRow} style={{ marginTop: '1rem', borderTop: '1px solid var(--color-surface-border)', paddingTop: '2rem' }}>
              <span style={{ color: 'var(--color-text)', fontSize: '2rem', fontWeight: 600 }}>Total</span>
              <strong className={styles.totalAmount}>{formatBs(total)}{rate > 0 && <span className={styles.amountUsd}>{formatUSD(total / rate)}</span>}</strong>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/productos')}>
              Volver
            </button>
            <button type="button" className="btn btn-accent" onClick={handlePay}>
              Finalizar Compra
            </button>
          </div>
        </>
      )}
    </div>

  )

}
