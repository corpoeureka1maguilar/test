import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useCartStore, useCartTotal } from '@/features/cart/stores/cart'
import styles from './CartReview.module.css'

export function CartReview() {
  const { send } = useSaleMachine()
  const navigate = useNavigate()
  const { items, setQty, removeItem } = useCartStore()
  const total = useCartTotal()

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
                      <div className={styles.productName}>{item.name}</div>
                      {item.defaultCode && <div className={styles.code}>{item.defaultCode}</div>}
                    </td>
                    <td>Bs. {item.price.toFixed(2)}</td>
                    <td>
                      <div className={styles.qtyControl}>
                        <button type="button" onClick={() => setQty(item.productId, item.qty - 1)}>−</button>
                        <span>{item.qty}</span>
                        <button type="button" onClick={() => setQty(item.productId, item.qty + 1)}>+</button>
                      </div>
                    </td>
                    <td className={styles.subtotal}>Bs. {item.subtotal.toFixed(2)}</td>
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
              <span>Bs. {total.toFixed(2)}</span>
            </div>
            <div className={styles.totalRow}>
              <span>Impuestos estimados</span>
              <span>Bs. 0.00</span>
            </div>
            <div className={styles.totalRow} style={{ marginTop: '1rem', borderTop: '1px solid var(--color-surface-border)', paddingTop: '2rem' }}>
              <span style={{ color: '#fff', fontSize: '2rem', fontWeight: 600 }}>Total</span>
              <strong className={styles.totalAmount}>Bs. {total.toFixed(2)}</strong>
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
