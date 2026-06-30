import { Money, DeviceMobile, CreditCard, Bank, CurrencyBtc, Envelope, Fingerprint, Wallet } from '@phosphor-icons/react'
import type { KioskPaymentMethod, PaymentType } from '@/shared/types/types'
import { getPaymentLabel } from '@/shared/lib/paymentUtils'
import styles from './AppPaymentMethodCard.module.css'

const PAYMENT_ICONS: Record<PaymentType, React.ElementType> = {
  cash: Money,
  pago_movil: DeviceMobile,
  card: CreditCard,
  transferencia: Bank,
  crypto: CurrencyBtc,
  zelle: Envelope,
  otro: Wallet,
  biopago: Fingerprint,
  banplus: Bank,
}

interface Props {
  method: KioskPaymentMethod
  onSelect: (method: KioskPaymentMethod) => void
}

export function AppPaymentMethodCard({ method, onSelect }: Props) {
  const Icon = PAYMENT_ICONS[method.paymentType] ?? Wallet

  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => onSelect(method)}
    >
      <div className={styles.iconWrapper}>
        <Icon size={28} weight="duotone" className={styles.icon} />
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{method.name || getPaymentLabel(method.paymentType)}</span>
        {method.applyIgtf && (
          <span className={styles.igtf}>+IGTF {method.igtfPercent}%</span>
        )}
      </div>
    </button>
  )
}
