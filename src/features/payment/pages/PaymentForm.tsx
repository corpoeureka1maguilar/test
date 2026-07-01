import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useCartTotal } from '@/features/cart/stores/cart'
import { getPaymentFormFields, getPaymentLabel, isValidVenezuelanPhone } from '@/shared/lib/paymentUtils'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { useUIStore } from '@/shared/stores/ui'
import styles from './PaymentForm.module.css'

export function PaymentForm() {
  const { send, context } = useSaleMachine()
  const navigate = useNavigate()
  const total = useCartTotal()
  const globalRate = useExchangeRateStore((s) => s.rate)
  const pushToast = useUIStore((s) => s.pushToast)

  const method = context.selectedMethod
  const [reference, setReference] = useState('')
  const [bank, setBank] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (!method) navigate('/pago')
  }, [method, navigate])

  if (!method) return null

  const fields = getPaymentFormFields(method.paymentType)
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

    if (fields.includes('phone') && !isValidVenezuelanPhone(phone)) {
      pushToast('error', 'El número de teléfono ingresado no es válido')
      return
    }

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
                <span>Subtotal</span>
                <strong>
                   {globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(total / globalRate)}</span>}
                  <span className={styles.amountSecondary}>{formatBs(total)}</span>
          
                </strong>
              </div>

              {igtfBs > 0 && (
                <div className={styles.amountRow}>
                  <span>IGTF ({method.igtfPercent}%)</span>
                  <strong>
                    {currencySymbol} {igtfUSD?.toFixed(2) ?? '—'}
                    <span className={styles.amountSecondary}>{formatBs(igtfBs)}</span>
                    {globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(igtfBs / globalRate)}</span>}
                  </strong>
                </div>
              )}

              <div className={`${styles.amountRow} ${styles.total}`}>
                <span>Total a pagar</span>
                <strong>
                  
                  {globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(totalWithIgtfBs / globalRate)}</span>}
                  <span className={styles.amountSecondary}>{formatBs(totalWithIgtfBs)}</span>
                </strong>
              </div>
            </>
          ) : (
            <>
              <div className={styles.amountRow}>
                <span>Subtotal</span>
                <strong>{formatBs(total)}{globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(total / globalRate)}</span>}</strong>
              </div>

              {igtfBs > 0 && (
                <div className={styles.amountRow}>
                  <span>IGTF ({method.igtfPercent}%)</span>
                  <strong>{formatBs(igtfBs)}{globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(igtfBs / globalRate)}</span>}</strong>
                </div>
              )}

              <div className={`${styles.amountRow} ${styles.total}`}>
                <span>Total a pagar</span>
                <strong>{formatBs(totalWithIgtfBs)}{globalRate > 0 && <span className={styles.amountUsd}>{formatUSD(totalWithIgtfBs / globalRate)}</span>}</strong>
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
