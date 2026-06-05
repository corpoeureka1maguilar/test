import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { usePaymentMethods } from '@/features/payment/hooks/usePaymentMethods'
import { useCartTotal } from '@/features/cart/stores/cart'
import { AppPaymentMethodCard } from '@/features/payment/components/AppPaymentMethodCard'
import type { KioskPaymentMethod } from '@/shared/types/types'
import styles from './PaymentSelect.module.css'

export function PaymentSelect() {
  const { send } = useSaleMachine()
  const navigate = useNavigate()
  const { data: methods = [], isLoading } = usePaymentMethods()
  const total = useCartTotal()

  const handleSelect = (method: KioskPaymentMethod) => {
    send({ type: 'SELECT_METHOD', method })
    navigate(`/pago/${method.id}`)
  }

  return (
    <div className="kiosk-container">
      <h2 className={styles.title}>Elegí cómo pagar</h2>
      <p className={styles.total}>Total: <strong>Bs. {total.toFixed(2)}</strong></p>

      {isLoading ? (
        <p className={styles.loading}>Cargando métodos de pago...</p>
      ) : (
        <div className={styles.grid}>
          {methods.map(method => (
            <AppPaymentMethodCard key={method.id} method={method} onSelect={handleSelect} />
          ))}
        </div>
      )}

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => navigate('/carrito')}
      >
        Volver al carrito
      </button>
    </div>
  )
}
