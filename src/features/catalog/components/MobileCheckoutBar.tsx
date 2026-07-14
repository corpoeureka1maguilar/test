import { formatBs, formatUSD } from '@/shared/lib/money'
import styles from '../pages/ProductCatalog.module.css'

interface Props {
  count: number
  total: number
  rate: number
  onCheckout: () => void
}

/** Barra de checkout fija para mobile */
export function MobileCheckoutBar({ count, total, rate, onCheckout }: Props) {
  return (
    <div className={styles.mobileCheckoutBar}>
      <div className={styles.mobileCheckoutInfo}>
        <span className={styles.mobileCheckoutCount}>
          {count} {count === 1 ? 'elemento' : 'elementos'}
        </span>
        <span className={styles.mobileCheckoutTotal}>
          Total: {formatBs(total)}{rate > 0 && <span className={styles.amountUsd}>{formatUSD(total / rate)}</span>}
        </span>
      </div>
      <button
        type="button"
        className="btn btn-accent"
        onClick={onCheckout}
      >
        PAGAR AHORA
      </button>
    </div>
  )
}
