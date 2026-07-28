import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useCreatePartner } from '@/features/customer/hooks/useCreatePartner'
import { useUIStore } from '@/shared/stores/ui'
import { AppVirtualKeyboard } from '@/shared/components/AppVirtualKeyboard'
import { useAddressAutocomplete } from '@/features/customer/hooks/useAddressAutocomplete'
import { useConfigStore } from '@/shared/stores/config'
import { useRegisterForm } from '@/features/customer/hooks/useRegisterForm'
import { VenezuelanPhoneField } from '@/features/customer/components/VenezuelanPhoneField'
import { InternationalPhoneField } from '@/features/customer/components/InternationalPhoneField'
import { fetchStates, type OdooState } from '@/shared/lib/odooRepository'

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

  const {
    form,
    activeField,
    setActiveField,
    set,
    handleKeyboardChange,
    handleSuggestionSelect,
    handleStateSelect,
    phoneInput,
    validate
  } = useRegisterForm({ branchState, vat })

  const [states, setStates] = useState<OdooState[]>([])

  useEffect(() => {
    fetchStates()
      .then(setStates)
      .catch((err) => {
        console.warn('Error fetching states from Odoo, using fallback:', err)
        setStates([
          { id: 1, name: 'Amazonas', code: 'AM' },
          { id: 2, name: 'Anzoátegui', code: 'AN' },
          { id: 3, name: 'Apure', code: 'AP' },
          { id: 4, name: 'Aragua', code: 'AR' },
          { id: 5, name: 'Barinas', code: 'BA' },
          { id: 6, name: 'Bolívar', code: 'BO' },
          { id: 7, name: 'Carabobo', code: 'CA' },
          { id: 8, name: 'Cojedes', code: 'CO' },
          { id: 9, name: 'Delta Amacuro', code: 'DA' },
          { id: 10, name: 'Distrito Capital', code: 'DC' },
          { id: 11, name: 'Falcón', code: 'FA' },
          { id: 12, name: 'Guárico', code: 'GU' },
          { id: 13, name: 'Lara', code: 'LA' },
          { id: 14, name: 'Mérida', code: 'ME' },
          { id: 15, name: 'Miranda', code: 'MI' },
          { id: 16, name: 'Monagas', code: 'MO' },
          { id: 17, name: 'Nueva Esparta', code: 'NE' },
          { id: 18, name: 'Portuguesa', code: 'PO' },
          { id: 19, name: 'Sucre', code: 'SU' },
          { id: 20, name: 'Táchira', code: 'TA' },
          { id: 21, name: 'Trujillo', code: 'TR' },
          { id: 22, name: 'Vargas', code: 'VA' },
          { id: 23, name: 'Yaracuy', code: 'YA' },
          { id: 24, name: 'Zulia', code: 'ZU' }
        ])
      })
  }, [])

  const filteredStates = useMemo(() => {
    const q = (form.estado || '').trim().toLowerCase()
    if (!q) return states
    return states.filter(s => s.name.toLowerCase().includes(q))
  }, [states, form.estado])

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget || relatedTarget.tagName !== 'INPUT') {
      setTimeout(() => {
        setIsKeyboardMinimized(true)
      }, 150)
    }
  }

  const { suggestions, isLoading: isSearching, search: searchAddress, clear: clearSuggestions } = useAddressAutocomplete()

  const formatVatForUI = (v: string) => {
    const parts = v.split('-')
    if (parts.length === 2 && parts[0] === 'V') {
      const digits = parts[1]!.replace(/^0+/, '')
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

  const [isKeyboardMinimized, setIsKeyboardMinimized] = useState(false)

  return (
    <div
      className={`kiosk-container pb-8 ${
        activeField ? (isKeyboardMinimized ? 'pb-[80px]' : 'pb-[320px]') : ''
      }`}
    >
      <h2 className="font-extrabold mb-4 text-black text-center">Registrate para continuar</h2>

      <div className="card [@media(orientation:landscape)_and_(min-width:700px)]:max-w-[880px]">
        <form
          className="flex flex-col gap-4 w-full [&_label]:flex [&_label]:flex-col [&_label]:gap-[0.4rem] [&_label]:text-[0.95rem] [&_label]:font-bold [&_label]:text-text-muted [&_label]:uppercase [&_label]:tracking-[0.05em] [@media(orientation:landscape)_and_(min-width:700px)]:grid [@media(orientation:landscape)_and_(min-width:700px)]:grid-cols-2 [@media(orientation:landscape)_and_(min-width:700px)]:gap-x-6 [@media(orientation:landscape)_and_(min-width:700px)]:gap-y-[0.85rem]"
          onSubmit={(e) => { void handleSubmit(e) }}
        >
          <label>Nombre y apellido *
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              onFocus={() => { setActiveField('name'); setIsKeyboardMinimized(false); }}
              onBlur={handleInputBlur}
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
              className="opacity-50 cursor-default pointer-events-none"
            />
          </label>
          {phoneInput.isInternational ? (
            <InternationalPhoneField
              {...phoneInput}
              onFocus={() => { setActiveField('phone'); setIsKeyboardMinimized(false); }}
              onBlur={handleInputBlur}
              onBackToVenezuelan={phoneInput.canSwitchToVenezuelan ? phoneInput.switchToVenezuelan : undefined}
            />
          ) : (
            <VenezuelanPhoneField
              {...phoneInput}
              isActive={activeField === 'phone'}
              onFocus={() => { setActiveField('phone'); setIsKeyboardMinimized(false); }}
              onBlur={handleInputBlur}
              onSwitchToInternational={phoneInput.switchToInternational}
            />
          )}
          <label>Correo electrónico
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              onFocus={() => { setActiveField('email'); setIsKeyboardMinimized(false); }}
              onBlur={handleInputBlur}
              inputMode="none"
              placeholder="correo@ejemplo.com"
            />
          </label>
          <div className="relative flex flex-col">
            <label>Estado *
              <input
                type="text"
                value={form.estado}
                onChange={set('estado')}
                onFocus={() => { setActiveField('estado'); setIsKeyboardMinimized(false); }}
                onBlur={handleInputBlur}
                inputMode="none"
                placeholder="Ej: Zulia, Miranda..."
                required
              />
            </label>
            {activeField === 'estado' && filteredStates.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-[10001] flex flex-col bg-surface border border-surface-border rounded-xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.12)] max-h-[220px] overflow-y-auto">
                {filteredStates.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className="bg-transparent border-0 border-t border-surface-border first:border-t-0 px-5 py-4 text-left text-base text-text cursor-pointer leading-[1.4] transition-colors duration-150 ease active:bg-surface-hover"
                    onMouseDown={e => {
                      e.preventDefault()
                      handleStateSelect(s.name)
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative flex flex-col">
            <label>Dirección *
              <input
                type="text"
                value={form.street}
                onChange={set('street')}
                onFocus={() => { setActiveField('street'); setIsKeyboardMinimized(false); }}
                onBlur={handleInputBlur}
                inputMode="none"
                placeholder="Av., Calle, Sector..."
                required
              />
            </label>

            {activeField === 'street' && (suggestions.length > 0 || isSearching) && (
              <div className="absolute top-full left-0 right-0 z-[10001] flex flex-col bg-surface border border-surface-border rounded-xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.12)] max-h-[220px] overflow-y-auto">
                {isSearching && <div className="px-5 py-4 text-base text-text-muted">Buscando...</div>}
                {suggestions.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className="bg-transparent border-0 border-t border-surface-border first:border-t-0 px-5 py-4 text-left text-base text-text cursor-pointer leading-[1.4] transition-colors duration-150 ease active:bg-surface-hover"
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

          <div className="flex flex-col gap-4 mt-4 [@media(orientation:landscape)_and_(min-width:700px)]:col-[1/-1] [@media(orientation:landscape)_and_(min-width:700px)]:flex-row">
            <button
              type="submit"
              className="btn btn-primary [@media(orientation:landscape)_and_(min-width:700px)]:flex-1 [@media(orientation:landscape)_and_(min-width:700px)]:max-w-none"
              disabled={isPending}
            >
              {isPending ? 'Registrando...' : 'Continuar'}
            </button>
            <button
              type="button"
              className="btn btn-secondary [@media(orientation:landscape)_and_(min-width:700px)]:flex-1 [@media(orientation:landscape)_and_(min-width:700px)]:max-w-none"
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
          onEnter={() => setIsKeyboardMinimized(true)}
          layoutType="text"
          isMinimized={isKeyboardMinimized}
          onMinimizeChange={setIsKeyboardMinimized}
        />
      )}
    </div>
  )
}
