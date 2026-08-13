import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { usePartnerByCedula } from '@/features/customer/hooks/usePartnerByCedula'
import { AppNumericKeyboard } from '@/shared/components/AppNumericKeyboard'
import { useUIStore } from '@/shared/stores/ui'

const PREFIXES = ['V', 'E', 'J', 'G', 'P', 'C'] as const
type Prefix = typeof PREFIXES[number]

export function CustomerIdentity() {
  const { send, matches } = useSaleMachine()
  const navigate = useNavigate()
  const { mutateAsync: search, isPending } = usePartnerByCedula()
  const pushToast = useUIStore(s => s.pushToast)
  const scannerRef = useRef<HTMLInputElement>(null)

  const [prefix, setPrefix] = useState<Prefix>('V')
  const [digits, setDigits] = useState('')

  const formatDigits = (d: string) => {
    let cleanDigits = d
    if (prefix === 'V') {
      cleanDigits = d.replace(/^0+/, '')
    }
    return cleanDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  useEffect(() => {
    if (!matches('enteringCedula') && !matches('idle')) {
      send({ type: 'RESET' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (matches('idle')) {
      send({ type: 'START' })
    }
    scannerRef.current?.focus()
  }, [matches, send])

  const performSearch = async (p: Prefix, d: string) => {
    if (d.length < 6) {
      pushToast('error', 'La cédula o RIF debe tener al menos 6 dígitos')
      return
    }
    if ((p === 'V' || p === 'E') && d.length > 9) {
      pushToast('error', 'La cédula debe tener entre 6 y 9 dígitos')
      return
    }
    if ((p === 'J' || p === 'G') && d.length > 9) {
      pushToast('error', 'El RIF debe tener entre 6 y 9 dígitos')
      return
    }

    const limit = (p === 'V' || p === 'E') ? 8 : 9
    const padded = p === 'V' ? d.padStart(limit, '0') : d.padEnd(limit, '0')
    const partner = await search(`${p}-${padded}`)
    if (partner) {
      send({ type: 'FOUND', customer: partner })
      navigate('/productos')
    } else {
      send({ type: 'NOT_FOUND', vat: `${p}-${padded}` })
      navigate('/registro')
    }
  }

  const handleConfirm = () => {
    performSearch(prefix, digits).catch((err) => {
      pushToast('error', `Error al buscar: ${(err as Error).message}`)
    })
  }

  const handleScannerKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const raw = e.currentTarget.value.trim().toUpperCase()
    e.currentTarget.value = ''

    const withPrefix = raw.match(/^([VEJG])-?(\d{6,10})$/)
    const digitsOnly = raw.match(/^(\d{6,10})$/)

    if (withPrefix) {
      const p = withPrefix[1] as Prefix
      const d = withPrefix[2]!
      setPrefix(p)
      setDigits(d)
      await performSearch(p, d)
    } else if (digitsOnly) {
      const d = digitsOnly[1]!
      setDigits(d)
      await performSearch(prefix, d)
    } else {
      pushToast('error', 'Formato de cédula o RIF escaneado inválido')
    }
  }

  return (
    <div className="kiosk-container">
      <input
        ref={scannerRef}
        type="text"
        aria-hidden="true"
        className="absolute opacity-0 pointer-events-none"
        onKeyDown={(e) => {
          handleScannerKeyDown(e).catch((err) => {
            pushToast('error', `Error al buscar: ${(err as Error).message}`)
          })
        }}
        readOnly={isPending}
      />
      <h2 className="text-center">¿Cuál es tu cédula o RIF?</h2>

      <div className="flex gap-3 justify-center mx-auto mb-3 desktop:mb-4 w-full max-w-[400px] bg-surface p-[0.4rem] rounded-[50px]">
        {PREFIXES.map(p => (
          <button
            key={p}
            type="button"
            className={
              prefix === p
                ? 'flex-1 h-12 desktop:h-13 text-xl font-semibold font-app bg-text border-0 text-white rounded-[50px] cursor-pointer transition flex items-center justify-center shadow-[0_10px_20px_rgba(0,0,0,0.15)]'
                : 'flex-1 h-12 desktop:h-13 text-xl font-semibold font-app bg-transparent border-0 text-text-muted rounded-[50px] cursor-pointer transition flex items-center justify-center active:scale-[0.96] active:opacity-70'
            }
            onClick={() => setPrefix(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="text-[length:var(--font-display)] font-light tracking-[-0.02em] text-center mx-auto mb-3 desktop:mb-4 min-h-[56px] desktop:min-h-[64px] w-full max-w-[800px] text-text flex items-center justify-center gap-2 tabular-nums">
        {prefix}-{formatDigits(digits) || <span className="text-surface-heavy tracking-[0.1em]">__________</span>}
      </div>

      <AppNumericKeyboard value={digits} onChange={setDigits} maxLength={10} onConfirm={handleConfirm} />

      <div className="flex flex-col gap-3 mt-3 desktop:mt-4 w-full max-w-[480px] items-center">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleConfirm}
          disabled={digits.length < 6 || isPending}
        >
          {isPending ? 'Buscando...' : 'Continuar'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => { send({ type: 'RESET' }); navigate('/') }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
