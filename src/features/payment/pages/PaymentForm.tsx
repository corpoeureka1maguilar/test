import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useCartTotal } from '@/features/cart/stores/cart'
import { getPaymentFormFields, getPaymentLabel } from '@/shared/lib/paymentUtils'
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
  const igtfAmount = method.applyIgtf ? total * (method.igtfPercent / 100) : 0
  const totalWithIgtf = total + igtfAmount

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    send({
      type: 'SUBMIT_PAYMENT',
      payment: {
        methodId: method.id,
        reference,
        bank: bank || undefined,
        phone: phone || undefined,
        amount: total,
        igtfAmount
      }
    })
    navigate('/resultado')
  }

  return (
    <div className="kiosk-container">
      <h1 className={styles.title}>{method.name || getPaymentLabel(method.paymentType)}</h1>

      <div className={styles.summaryContainer}>
        <div className={styles.summaryCard}>
          <div className={styles.amountRow}>
            <span>Subtotal</span>
            <strong>Bs. {total.toFixed(2)}</strong>
          </div>
          <div className={`${styles.amountRow} ${styles.total}`}>
            <span>Total a pagar</span>
            <strong>Bs. {totalWithIgtf.toFixed(2)}</strong>
          </div>
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
          <button type="submit" className="btn btn-accent">Confirmar pago</button>
          <button type="button" className="btn btn-secondary" onClick={() => { send({ type: 'BACK' }); navigate('/pago') }}>Volver</button>
        </div>
      </form>
    </div>
  )
}
