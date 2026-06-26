import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useCreatePartner } from '@/features/customer/hooks/useCreatePartner'
import { useUIStore } from '@/shared/stores/ui'
import { AppVirtualKeyboard } from '@/shared/components/AppVirtualKeyboard'
import styles from './CustomerRegister.module.css'

export function CustomerRegister() {
  const { send, context } = useSaleMachine()
  const navigate = useNavigate()
  const { mutateAsync: createPartner, isPending } = useCreatePartner()
  const pushToast = useUIStore(s => s.pushToast)

  useEffect(() => {
    if (!context.pendingVat) {
      navigate('/cedula')
    }
  }, [context.pendingVat, navigate])

  const [form, setForm] = useState({
    name: '',
    phone: '',
    street: ''
  })

  const [activeField, setActiveField] = useState<'name' | 'phone' | 'street' | null>(null)

  const vat = context.pendingVat ?? ''
  console.log('DEBUG CustomerRegister: context.pendingVat =', context.pendingVat, 'vat =', vat)
  const formattedVat = vat.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.')
  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  const handleKeyboardChange = (val: string) => {
    if (!activeField) return
    setForm(f => ({ ...f, [activeField]: val }))
  }

  const handleKeyboardEnter = () => {
    if (activeField === 'name') {
      setActiveField('phone')
    } else if (activeField === 'phone') {
      setActiveField('street')
    } else {
      setActiveField(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { pushToast('error', 'El nombre es requerido'); return }

    try {
      const partner = await createPartner({
        name: form.name.trim(),
        cedula: vat,
        phone: form.phone.trim() || undefined,
        street: form.street.trim() || undefined
      })
      send({ type: 'REGISTERED', customer: partner })
      navigate('/productos')
    } catch (err) {
      pushToast('error', `Error al registrar: ${(err as Error).message}`)
    }
  }

  return (
    <div className="kiosk-container" style={{ paddingBottom: activeField ? '320px' : '2rem' }}>
      <h2 className={styles.title}>Registrate para continuar</h2>

      <div className="card">
        <p className={styles.vatDisplay}>
          Cédula / RIF: <strong>{formattedVat}</strong>
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label>Nombre completo *
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              onFocus={() => setActiveField('name')}
              inputMode="none"
              placeholder="Nombre y apellido"
              autoFocus
              required
            />
          </label>
          <label>Teléfono (opcional)
            <input
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              onFocus={() => setActiveField('phone')}
              inputMode="none"
              placeholder="04XX-XXXXXXX"
            />
          </label>
          <label>Dirección fiscal (opcional)
            <input
              type="text"
              value={form.street}
              onChange={set('street')}
              onFocus={() => setActiveField('street')}
              inputMode="none"
              placeholder="Dirección"
            />
          </label>

          <div className={styles.actions}>
            <button type="submit" className="btn btn-primary" disabled={isPending}>
              {isPending ? 'Registrando...' : 'Continuar'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/cedula')}
            >
              Volver
            </button>
          </div>
        </form>
      </div>

      {activeField && (
        <AppVirtualKeyboard
          value={form[activeField]}
          onChange={handleKeyboardChange}
          onClose={() => setActiveField(null)}
          onEnter={handleKeyboardEnter}
          layoutType={activeField === 'phone' ? 'tel' : 'text'}
        />
      )}
    </div>
  )
}
