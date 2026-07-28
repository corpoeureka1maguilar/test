import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useCartStore } from '@/features/cart/stores/cart'
import { AppPinModal } from '@/features/payment/components/AppPinModal'
import { KIOSK_OPERATIONS } from '@/shared/lib/odooRepository'
import { trackSale } from '@/shared/lib/metrics'

export function PaymentResult() {
  const { state, context, send } = useSaleMachine()
  const navigate = useNavigate()
  const clearCart = useCartStore(s => s.clearCart)
  // Excepciones tras un fallo de impresión: tanto reintentar como finalizar
  // sin factura son operaciones auditadas que exigen clave de administrador
  const [pendingPrintAction, setPendingPrintAction] = useState<'retry' | 'continue' | null>(null)

  const isSuccess = state === 'success'
  const isError = state === 'paymentError'
  const isPrintError = state === 'printingError'
  const isProcessing = state === 'processing' || state === 'enqueuingOffline' || state === 'printing'

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
    if (!isSuccess && !isError && !isPrintError && !isProcessing) {
      navigate('/')
    }
  }, [isSuccess, isError, isPrintError, isProcessing, navigate])

  if (isProcessing) {
    return (
      <div className="kiosk-container justify-center items-center gap-6 text-center">
        <div className="h-[70px] w-[70px] animate-spin rounded-full border-[6px] border-surface [border-top-color:var(--color-accent)]" />
        <p>
          {state === 'printing'
            ? 'Imprimiendo factura...'
            : state === 'enqueuingOffline'
              ? 'Servidor no disponible, guardando la venta localmente...'
              : 'Procesando pago...'}
        </p>
      </div>
    )
  }

  // El pago YA se registró en Odoo pero la factura fiscal no salió: hay que
  // ofrecer reintento de impresión antes de dar la venta por cerrada
  if (isPrintError) {
    return (
      <div className="kiosk-container justify-center items-center gap-6 text-center">
        <div className="mx-auto flex h-[100px] w-[100px] items-center justify-center rounded-full bg-danger/10 text-[4rem] text-danger animate-scaleIn">⚠</div>
        <h2 className="m-0">Pago registrado, factura pendiente</h2>
        <p className="max-w-[400px] text-[length:var(--font-lead)] leading-[1.4] text-text-muted">
          {context.printError ?? 'No se pudo imprimir la factura fiscal.'}
        </p>
        <div className="flex w-full flex-col items-center gap-4">
          <button type="button" className="btn btn-primary" onClick={() => setPendingPrintAction('retry')}>
            Reintentar impresión
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setPendingPrintAction('continue')}>
            Continuar sin factura
          </button>
        </div>

        {pendingPrintAction && (
          <AppPinModal
            title={pendingPrintAction === 'retry'
              ? 'Confirma para reintentar la impresión'
              : 'Confirma para finalizar sin factura'}
            operationRef={pendingPrintAction === 'retry'
              ? KIOSK_OPERATIONS.invoiceReprint
              : KIOSK_OPERATIONS.continueWithoutInvoice}
            auditMessage={pendingPrintAction === 'retry'
              ? `Reintento de impresión fiscal (orden ${context.odooOrderId ?? 'desconocida'}): ${context.printError ?? 'error de impresión'}`
              : `Venta finalizada sin factura fiscal (orden ${context.odooOrderId ?? 'desconocida'}): ${context.printError ?? 'error de impresión'}`}
            onConfirmed={() => {
              const action = pendingPrintAction
              setPendingPrintAction(null)
              send({ type: action === 'retry' ? 'RETRY' : 'CONTINUE' })
            }}
            onCancel={() => setPendingPrintAction(null)}
          />
        )}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="kiosk-container justify-center items-center gap-6 text-center">
        <div className="mx-auto flex h-[100px] w-[100px] items-center justify-center rounded-full bg-danger/10 text-[4rem] text-danger animate-scaleIn">✕</div>
        <h2 className="m-0">Error en el pago</h2>
        <p className="max-w-[400px] text-[length:var(--font-lead)] leading-[1.4] text-text-muted">{context.errorMessage ?? 'Ocurrió un error al procesar el pago.'}</p>
        <div className="flex w-full flex-col items-center gap-4">
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
    <div className="kiosk-container justify-center items-center gap-6 text-center">
      <div className="mx-auto flex h-[100px] w-[100px] items-center justify-center rounded-full bg-accent-subtle text-[4rem] text-accent animate-scaleIn">✓</div>
      <h2 className="m-0">¡Pago confirmado!</h2>

      {context.queuedOffline && (
        <p>
          Se registrará y sincronizará cuando el servidor esté disponible.
        </p>
      )}

      {context.printerResult && (
        <div className="glass-card flex w-full max-w-[400px] flex-col gap-3 bg-surface p-5 text-left text-[1.05rem] [&_p]:m-0 [&_p]:flex [&_p]:justify-between [&_p]:text-text-muted [&_p_strong]:text-text">
          <p>Factura N°: <strong>{context.printerResult.code}</strong></p>
          <p>Fecha: <strong>{context.printerResult.date}</strong></p>
          <p>Serial: <strong>{context.printerResult.serial}</strong></p>
        </div>
      )}

      {context.printError && (
        <p>⚠ La impresión falló: {context.printError}</p>
      )}

      {context.countdown > 0 && (
        <p className="text-[1.1rem] italic text-text-muted">Volviendo al inicio en {context.countdown}s...</p>
      )}

      <div className="flex w-full flex-col items-center gap-4">
        <button type="button" className="btn btn-primary" onClick={() => { send({ type: 'RESET' }); navigate('/') }}>
          Finalizar
        </button>
      </div>
    </div>
  )
}
