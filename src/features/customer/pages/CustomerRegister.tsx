import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useCreatePartner } from '@/features/customer/hooks/useCreatePartner'
import { useUIStore } from '@/shared/stores/ui'
import { AppVirtualKeyboard } from '@/shared/components/AppVirtualKeyboard'
import { useAddressAutocomplete } from '@/features/customer/hooks/useAddressAutocomplete'
import { useConfigStore } from '@/shared/stores/config'
import { useRegisterForm } from '@/features/customer/hooks/useRegisterForm'
import styles from './CustomerRegister.module.css'

export function CustomerRegister() {
  const { send, context, matches } = useSaleMachine()
  const navigate = useNavigate()
  const { mutateAsync: createPartner, isPending } = useCreatePartner()
  const pushToast = useUIStore(s => s.pushToast)
  const branchState = useConfigStore(s => s.branchState)

  useEffect(() => {
    const isRegisterState = matches('registeringCustomer') || matches('enteringCedula') || matches('browsingProducts')
    if (!isRegisterState || (matches('registeringCustomer') && !context.pendingVat)) {
      navigate('/cedula')
    }
  }, [context.pendingVat, matches, navigate])

  const vat = context.pendingVat ?? ''
  console.log('DEBUG CustomerRegister: context.pendingVat =', context.pendingVat, 'vat =', vat)

  const {
    form,
    activeField,
    setActiveField,
    set,
    handleKeyboardChange,
    handleSuggestionSelect,
    handlePrefixSelect,
    validate
  } = useRegisterForm({ branchState, vat })

  const { suggestions, isLoading: isSearching, search: searchAddress, clear: clearSuggestions } = useAddressAutocomplete()

  const formatVatForUI = (v: string) => {
    const parts = v.split('-')
    if (parts.length === 2 && parts[0] === 'V') {
      const digits = parts[1].replace(/^0+/, '')
      const formattedDigits = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      return `V-${formattedDigits || '0'}`
    }
    return v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.')
  }
  const formattedVat = formatVatForUI(vat)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setActiveField(null)

    const result = validate()
    if (!result.success) {
      const firstError = result.error.issues[0]?.message
      if (firstError) {
        pushToast('error', firstError)
      }
      return
    }

    const validData = result.data

    try {
      const streetParts = [validData.estado.trim(), validData.street?.trim()].filter(Boolean)
      const partner = await createPartner({
        name: validData.name.trim(),
        cedula: vat,
        phone: validData.phone?.trim() || undefined,
        street: streetParts.length ? streetParts.join(', ') : undefined,
        email: validData.email?.trim() || undefined
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
            {activeField === 'phone' && (
              <div className={styles.prefixContainer}>
                {['0412', '0414', '0424', '0426', '0422'].map(prefix => (
                  <button
                    key={prefix}
                    type="button"
                    className={styles.prefixButton}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handlePrefixSelect(prefix)
                    }}
                  >
                    {prefix}
                  </button>
                ))}
                <div className={styles.prefixSeparator} />
                {['+'].map(prefix => (
                  <button
                    key={prefix}
                    type="button"
                    className={styles.prefixButton}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handlePrefixSelect(prefix)
                    }}
                  >
                    {prefix}
                  </button>
                ))}
              </div>
            )}
          </label>
          <label>Correo electrónico
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              onFocus={() => setActiveField('email')}
              inputMode="none"
              placeholder="correo@ejemplo.com"
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
                    onMouseDown={e => {
                      e.preventDefault()
                      handleSuggestionSelect(s, clearSuggestions)
                    }}
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
          value={form[activeField] || ''}
          onChange={(val) => handleKeyboardChange(val, searchAddress)}
          onClose={() => { setActiveField(null); clearSuggestions() }}
          onEnter={() => setActiveField(null)}
          layoutType={activeField === 'phone' ? 'tel' : 'text'}
        />
      )}
    </div>
  )
}
