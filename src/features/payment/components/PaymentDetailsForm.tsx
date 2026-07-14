import styles from '../pages/PaymentForm.module.css'

interface PaymentDetailsFormProps {
  fields: ('reference' | 'bank' | 'phone')[]
  bank: string
  onBankChange: (value: string) => void
  phone: string
  onPhoneChange: (value: string) => void
  reference: string
  onReferenceChange: (value: string) => void
  submitDisabled: boolean
  onSubmit: (e: React.FormEvent) => void
  onBack: () => void
}

export function PaymentDetailsForm({
  fields,
  bank,
  onBankChange,
  phone,
  onPhoneChange,
  reference,
  onReferenceChange,
  submitDisabled,
  onSubmit,
  onBack
}: PaymentDetailsFormProps) {
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {fields.includes('bank') && (
        <label className={styles.label}>
          <span>Banco</span>
          <input type="text" value={bank} onChange={e => onBankChange(e.target.value)} placeholder="Ej: Banesco" required />
        </label>
      )}
      {fields.includes('phone') && (
        <label className={styles.label}>
          <span>Teléfono</span>
          <input type="tel" value={phone} onChange={e => onPhoneChange(e.target.value)} placeholder="04XX-XXXXXXX" required />
        </label>
      )}
      {fields.includes('reference') && (
        <label className={styles.label}>
          <span>Referencia / Comprobante</span>
          <input type="text" value={reference} onChange={e => onReferenceChange(e.target.value)} placeholder="N° de referencia" required />
        </label>
      )}

      <div className={styles.actions}>
        <button type="submit" className="btn btn-accent" disabled={submitDisabled}>Confirmar pago</button>
        <button type="button" className="btn btn-secondary" onClick={onBack}>Volver</button>
      </div>
    </form>
  )
}
