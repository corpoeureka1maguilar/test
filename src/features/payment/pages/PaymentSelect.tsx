import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { usePaymentMethods } from '@/features/payment/hooks/usePaymentMethods'
import { useCartTotal } from '@/features/cart/stores/cart'
import { AppPaymentMethodCard } from '@/features/payment/components/AppPaymentMethodCard'
import type { KioskPaymentMethod } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import styles from './PaymentSelect.module.css'

export function PaymentSelect() {
  const { send } = useSaleMachine()
  const navigate = useNavigate()
  const { data: methods = [], isLoading } = usePaymentMethods()
  const total = useCartTotal()
  const rate = useExchangeRateStore((s) => s.rate)

  const handleSelect = (method: KioskPaymentMethod) => {
    send({ type: 'SELECT_METHOD', method })
    navigate(`/pago/${method.id}`)
  }

  return (
    <div className="kiosk-container">
      <h2 className={styles.title}>Elegí cómo pagar</h2>
      <p className={styles.total}>
        Total:&nbsp;<strong>{formatBs(total)}</strong>
        {rate > 0 && <span className={styles.amountUsd}>{formatUSD(total / rate)}</span>}
      </p>

      {isLoading ? (
        <p className={styles.loading}>Cargando métodos de pago...</p>
      ) : (
        <div className={styles.grid}>
          {methods.map(method => (
            <AppPaymentMethodCard key={method.id} method={method} onSelect={handleSelect} />
          ))}
        </div>
      )}
      <div className="sticky-controls">
      <button
        type="button"
        className="btn  btn-secondary"
        onClick={() => navigate('/productos')}
      >
        Volver a productos
      </button>
      </div>
      
    </div>
  )
}
