import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useCartStore } from '@/features/cart/stores/cart'
import { trackSale } from '@/shared/lib/metrics'
import styles from './PaymentResult.module.css'

export function PaymentResult() {
  const { state, context, send } = useSaleMachine()
  const navigate = useNavigate()
  const clearCart = useCartStore(s => s.clearCart)

  const isSuccess = state === 'success'
  const isError = state === 'paymentError'
  const isProcessing = state === 'processing' || state === 'printing'

  useEffect(() => {
    if (isSuccess) {
      const orderRef = context.printerResult?.code || context.activePayment?.reference || `TEMP-${Date.now()}`
      const totalBs = context.cart.reduce((sum, item) => sum + item.subtotal, 0)
      const igtfBs = context.selectedMethod?.applyIgtf ? totalBs * (context.selectedMethod.igtfPercent / 100) : 0
      const finalAmount = totalBs + igtfBs
      const methodName = context.selectedMethod?.name || 'Otro'

      trackSale(orderRef, finalAmount, methodName, context.cart)
      clearCart()
    }
  }, [isSuccess, clearCart, context])

  useEffect(() => {
    if (!isSuccess && !isError && !isProcessing) {
      navigate('/')
    }
  }, [isSuccess, isError, isProcessing, navigate])

  if (isProcessing) {
    return (
      <div className={`kiosk-container ${styles.center}`}>
        <div className={styles.spinner} />
        <p className={styles.processingText}>
          {state === 'printing' ? 'Imprimiendo factura...' : 'Procesando pago...'}
        </p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className={`kiosk-container ${styles.center}`}>
        <div className={styles.iconError}>✕</div>
        <h2 className={styles.title}>Error en el pago</h2>
        <p className={styles.message}>{context.errorMessage ?? 'Ocurrió un error al procesar el pago.'}</p>
        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" onClick={() => send({ type: 'RETRY' })}>
            Intentar de nuevo
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => { send({ type: 'RESET' }); navigate('/') }}>
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`kiosk-container ${styles.center}`}>
      <div className={styles.iconSuccess}>✓</div>
      <h2 className={styles.title}>¡Pago confirmado!</h2>

      {context.printerResult && (
        <div className={styles.receipt}>
          <p>Factura N°: <strong>{context.printerResult.code}</strong></p>
          <p>Fecha: <strong>{context.printerResult.date}</strong></p>
          <p>Serial: <strong>{context.printerResult.serial}</strong></p>
        </div>
      )}

      {context.printError && (
        <p className={styles.printWarning}>⚠ La impresión falló: {context.printError}</p>
      )}

      {context.countdown > 0 && (
        <p className={styles.countdown}>Volviendo al inicio en {context.countdown}s...</p>
      )}

      <div className={styles.actions}>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          Imprimir comprobante
        </button>
        <button type="button" className="btn btn-primary" onClick={() => { send({ type: 'RESET' }); navigate('/') }}>
          Finalizar
        </button>
      </div>
    </div>
  )
}
