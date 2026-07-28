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
    <form className="mx-auto flex w-full max-w-[600px] flex-col gap-6" onSubmit={onSubmit}>
      {fields.includes('bank') && (
        <label className="label-premium">
          <span>Banco</span>
          <input type="text" value={bank} onChange={e => onBankChange(e.target.value)} placeholder="Ej: Banesco" required />
        </label>
      )}
      {fields.includes('phone') && (
        <label className="label-premium">
          <span>Teléfono</span>
          <input type="tel" value={phone} onChange={e => onPhoneChange(e.target.value)} placeholder="04XX-XXXXXXX" required />
        </label>
      )}
      {fields.includes('reference') && (
        <label className="label-premium">
          <span>Referencia / Comprobante</span>
          <input type="text" value={reference} onChange={e => onReferenceChange(e.target.value)} placeholder="N° de referencia" required />
        </label>
      )}

      <div className="mt-6 flex w-full flex-col items-center gap-4">
        <button type="submit" className="btn btn-accent" disabled={submitDisabled}>Confirmar pago</button>
        <button type="button" className="btn btn-secondary" onClick={onBack}>Volver</button>
      </div>
    </form>
  )
}
