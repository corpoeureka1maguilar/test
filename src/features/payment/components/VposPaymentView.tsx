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

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '2rem' }}>
        {vposStatus === 'checking' ? (
          <>
            <div className={loadingStyles.spinner} />
            <p>Conectando con el terminal VPOS...</p>
          </>
        ) : (
          <iframe
            src={iframeUrl}
            title="VPOS Checkout"
            style={{
              width: '100%',
              maxWidth: '360px',
              height: '360px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px'
            }}
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
