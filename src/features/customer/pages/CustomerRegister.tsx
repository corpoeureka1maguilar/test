import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useCreatePartner } from '@/features/customer/hooks/useCreatePartner'
import { useUIStore } from '@/shared/stores/ui'
import { AppVirtualKeyboard } from '@/shared/components/AppVirtualKeyboard'
import { useAddressAutocomplete } from '@/features/customer/hooks/useAddressAutocomplete'
import { useConfigStore } from '@/shared/stores/config'
import { isValidVenezuelanPhone } from '@/shared/lib/paymentUtils'
import styles from './CustomerRegister.module.css'

export function CustomerRegister() {
  const { send, context } = useSaleMachine()
  const navigate = useNavigate()
  const { mutateAsync: createPartner, isPending } = useCreatePartner()
  const pushToast = useUIStore(s => s.pushToast)
  const branchState = useConfigStore(s => s.branchState)

  useEffect(() => {
    if (!context.pendingVat) {
      navigate('/cedula')
    }
  }, [context.pendingVat, navigate])

  const [form, setForm] = useState({
    name: '',
    phone: '',
    estado: branchState,
    street: ''
  })

  const [activeField, setActiveField] = useState<'name' | 'phone' | 'estado' | 'street' | null>(null)

  const { suggestions, isLoading: isSearching, search: searchAddress, clear: clearSuggestions } = useAddressAutocomplete()

  const vat = context.pendingVat ?? ''
  console.log('DEBUG CustomerRegister: context.pendingVat =', context.pendingVat, 'vat =', vat)
  const formattedVat = vat.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.')
  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))

  const handleKeyboardChange = (val: string) => {
    if (!activeField) return
    setForm(f => ({ ...f, [activeField]: val }))
    if (activeField === 'street') searchAddress(val)
  }

  const handleSuggestionSelect = (s: { street: string; estado: string }) => {
    setForm(f => ({ ...f, street: s.street, estado: f.estado || s.estado }))
    clearSuggestions()
    setActiveField(null)
  }

  const handleKeyboardEnter = () => {
    if (activeField === 'name') {
      setActiveField('phone')
    } else if (activeField === 'phone') {
      setActiveField('estado')
    } else if (activeField === 'estado') {
      setActiveField('street')
    } else {
      setActiveField(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { pushToast('error', 'El nombre es requerido'); return }
    if (form.phone.trim() && !isValidVenezuelanPhone(form.phone)) {
      pushToast('error', 'El número de teléfono ingresado no es válido')
      return
    }

    try {
      const streetParts = [form.estado.trim(), form.street.trim()].filter(Boolean)
      const partner = await createPartner({
        name: form.name.trim(),
        cedula: vat,
        phone: form.phone.trim() || undefined,
        street: streetParts.length ? streetParts.join(', ') : undefined
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
        <form className={styles.form} onSubmit={handleSubmit}>
          <label>Nombre y apellido *
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
          <label>Cédula / RIF
            <input
              type="text"
              value={formattedVat}
              readOnly
              className={styles.readonlyField}
            />
          </label>
          <label>Teléfono 
            <input
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              onFocus={() => setActiveField('phone')}
              inputMode="none"
              placeholder="04XX-XXXXXXX"
            />
          </label>
          <label>Estado 
            <input
              type="text"
              value={form.estado}
              onChange={set('estado')}
              onFocus={() => setActiveField('estado')}
              inputMode="none"
              placeholder="Ej: Zulia, Miranda..."
            />
          </label>
          <div className={styles.streetWrapper}>
            <label>Dirección
              <input
                type="text"
                value={form.street}
                onChange={set('street')}
                onFocus={() => setActiveField('street')}
                inputMode="none"
                placeholder="Av., Calle, Sector..."
              />
            </label>

            {activeField === 'street' && (suggestions.length > 0 || isSearching) && (
              <div className={styles.suggestionsDropdown}>
                {isSearching && <div className={styles.suggestionsLoading}>Buscando...</div>}
                {suggestions.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={styles.suggestionItem}
                    onMouseDown={e => { e.preventDefault(); handleSuggestionSelect(s) }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

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
          onClose={() => { setActiveField(null); clearSuggestions() }}
          onEnter={handleKeyboardEnter}
          layoutType={activeField === 'phone' ? 'tel' : 'text'}
        />
      )}
    </div>
  )
}
