import styles from '../pages/PaymentForm.module.css'
import loadingStyles from '@/shared/components/AppLoading.module.css'

interface VposPaymentViewProps {
  title: string
  vposStatus: 'checking' | 'waiting'
  iframeUrl: string
  onCancel: () => void
}

export function VposPaymentView({ title, vposStatus, iframeUrl, onCancel }: VposPaymentViewProps) {
  return (
    <div className="kiosk-container">
      <h1 className={styles.title}>{title}</h1>

      <div className={styles.vposWrapper}>
        {vposStatus === 'checking' ? (
          <>
            <div className={loadingStyles.spinner} />
            <p>Conectando con el terminal VPOS...</p>
          </>
        ) : (
          <iframe
            src={iframeUrl}
            title="VPOS Checkout"
            className={styles.vposIframe}
          />
        )}

        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar y Volver
          </button>
        </div>
      </div>
    </div>
  )
}
