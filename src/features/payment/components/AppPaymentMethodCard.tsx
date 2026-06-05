import type { KioskPaymentMethod } from '@/shared/types/types'
import { getPaymentLabel } from '@/shared/lib/paymentUtils'
import styles from './AppPaymentMethodCard.module.css'

interface Props {
  method: KioskPaymentMethod
  onSelect: (method: KioskPaymentMethod) => void
}

export function AppPaymentMethodCard({ method, onSelect }: Props) {
  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => onSelect(method)}
    >
      <span className={styles.name}>{method.name || getPaymentLabel(method.paymentType)}</span>
      {method.applyIgtf && (
        <span className={styles.igtf}>+IGTF {method.igtfPercent}%</span>
      )}
    </button>
  )
}
