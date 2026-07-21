import { AppNumericKeyboard } from '@/shared/components/AppNumericKeyboard'
import styles from '../pages/ProductCatalog.module.css'

interface Props {
  amountStr: string
  setAmountStr: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

/** Modal de monto para la compra de una tarjeta de regalo */
export function GiftCardAmountModal({ amountStr, setAmountStr, onConfirm, onCancel }: Props) {
  return (
    <div className={styles.giftCardModalOverlay} onClick={onCancel}>
      <div className={styles.giftCardModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.giftCardModalHeader}>
          <h3 className={styles.giftCardModalTitle}>Monto de la Tarjeta</h3>
          <span className={styles.giftCardModalSubtitle}>Ingrese el monto a recargar en USD</span>
        </div>
        <div className={styles.giftCardModalInputWrapper}>
          <span className={styles.giftCardModalLabel}>Monto ($)</span>
          <div className={styles.giftCardModalInput}>
            {amountStr ? `$ ${amountStr}` : <span className={styles.giftCardModalPlaceholder}>$ 0.00</span>}
          </div>
        </div>
        <AppNumericKeyboard
          value={amountStr}
          onChange={setAmountStr}
          maxLength={5}
          onConfirm={onConfirm}
        />
        <div className={styles.giftCardModalActions}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
