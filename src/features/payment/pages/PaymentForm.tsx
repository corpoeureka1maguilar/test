import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useCartTotal } from '@/features/cart/stores/cart'
import { getPaymentFormFields, getPaymentLabel } from '@/shared/lib/paymentUtils'
import { formatBs } from '@/shared/lib/money'
import styles from './PaymentForm.module.css'

export function PaymentForm() {
  const { send, context } = useSaleMachine()
  const navigate = useNavigate()
  const total = useCartTotal()

  const method = context.selectedMethod
  const [reference, setReference] = useState('')
  const [bank, setBank] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (!method) navigate('/pago')
  }, [method, navigate])

  if (!method) return null

  const fields = getPaymentFormFields(method.paymentType)

  // El carrito acumula en Bs. currencyRate = Bs por unidad de moneda extranjera (ej: 36.5 Bs/USD)
  const isForeign = !!method.currencyRate && method.currencyRate > 1
  const currencySymbol = method.currencySymbol || '$'
  const currencyName = method.currencyName || 'USD'
  const rate = method.currencyRate ?? 0
  const hasRate = rate > 0

  // Bs siempre disponible desde el carrito
  const igtfBs = method.applyIgtf ? total * (method.igtfPercent / 100) : 0
  const totalWithIgtfBs = total + igtfBs

  // USD = Bs / tasa (base en dólares, se aplica en Bs por la tasa del día)
  const subtotalUSD = hasRate ? total / rate : null
  const igtfUSD = hasRate ? igtfBs / rate : null
  const totalWithIgtfUSD = hasRate ? totalWithIgtfBs / rate : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const paymentAmount = isForeign ? (totalWithIgtfUSD ?? 0) : totalWithIgtfBs
    const paymentIgtf = isForeign ? (igtfUSD ?? 0) : igtfBs

    send({
      type: 'SUBMIT_PAYMENT',
      payment: {
        methodId: method.id,
        reference,
        bank: bank || undefined,
        phone: phone || undefined,
        amount: paymentAmount,
        igtfAmount: paymentIgtf
      }
    })
    navigate('/resultado')
  }

  return (
    <div className="kiosk-container">
      <h1 className={styles.title}>{method.name || getPaymentLabel(method.paymentType)}</h1>

      <div className={styles.summaryContainer}>
        <div className={styles.summaryCard}>

          {isForeign && !hasRate && (
            <div className={styles.noRateWarning}>
              Sin tasa de cambio disponible. No se puede procesar este método de pago.
            </div>
          )}

          {isForeign ? (
            <>
              <div className={styles.amountRow}>
                <span>Subtotal ({currencyName})</span>
                <strong>{currencySymbol} {subtotalUSD?.toFixed(2) ?? '—'}</strong>
              </div>
              <div className={styles.amountRowForeign}>
                <span>Subtotal (Bs)</span>
                <strong>{formatBs(total)}</strong>
              </div>

              {igtfBs > 0 && (
                <>
                  <div className={styles.amountRow}>
                    <span>IGTF {method.igtfPercent}% ({currencyName})</span>
                    <strong>{currencySymbol} {igtfUSD?.toFixed(2) ?? '—'}</strong>
                  </div>
                  <div className={styles.amountRowForeign}>
                    <span>IGTF {method.igtfPercent}% (Bs)</span>
                    <strong>{formatBs(igtfBs)}</strong>
                  </div>
                </>
              )}

              <div className={`${styles.amountRow} ${styles.total}`}>
                <span>Total ({currencyName})</span>
                <strong>{currencySymbol} {totalWithIgtfUSD?.toFixed(2) ?? '—'}</strong>
              </div>
              <div className={styles.totalForeign}>
                <span>Total (Bs)</span>
                <strong>{formatBs(totalWithIgtfBs)}</strong>
              </div>

              <div className={styles.rateRow}>
                <span>Tasa del día:</span>
                <span>1 {currencyName} = {hasRate ? `Bs. ${rate.toFixed(2)}` : 'No disponible'}</span>
              </div>
            </>
          ) : (
            <>
              <div className={styles.amountRow}>
                <span>Subtotal</span>
                <strong>{formatBs(total)}</strong>
              </div>

              {igtfBs > 0 && (
                <div className={styles.amountRow}>
                  <span>IGTF ({method.igtfPercent}%)</span>
                  <strong>{formatBs(igtfBs)}</strong>
                </div>
              )}

              <div className={`${styles.amountRow} ${styles.total}`}>
                <span>Total a pagar</span>
                <strong>{formatBs(totalWithIgtfBs)}</strong>
              </div>
            </>
          )}
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {fields.includes('bank') && (
          <label className={styles.label}>
            <span>Banco</span>
            <input type="text" value={bank} onChange={e => setBank(e.target.value)} placeholder="Ej: Banesco" required />
          </label>
        )}
        {fields.includes('phone') && (
          <label className={styles.label}>
            <span>Teléfono</span>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="04XX-XXXXXXX" required />
          </label>
        )}
        {fields.includes('reference') && (
          <label className={styles.label}>
            <span>Referencia / Comprobante</span>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="N° de referencia" required />
          </label>
        )}

        <div className={styles.actions}>
          <button type="submit" className="btn btn-accent" disabled={isForeign && !hasRate}>Confirmar pago</button>
          <button type="button" className="btn btn-secondary" onClick={() => { send({ type: 'BACK' }); navigate('/pago') }}>Volver</button>
        </div>
      </form>
    </div>
  )
}
