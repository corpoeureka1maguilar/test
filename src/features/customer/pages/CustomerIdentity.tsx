import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { usePartnerByCedula } from '@/features/customer/hooks/usePartnerByCedula'
import { AppNumericKeyboard } from '@/shared/components/AppNumericKeyboard'
import styles from './CustomerIdentity.module.css'

const PREFIXES = ['V', 'E', 'J', 'G'] as const
type Prefix = typeof PREFIXES[number]

export function CustomerIdentity() {
  const { send } = useSaleMachine()
  const navigate = useNavigate()
  const { mutateAsync: search, isPending } = usePartnerByCedula()
  const scannerRef = useRef<HTMLInputElement>(null)

  const [prefix, setPrefix] = useState<Prefix>('V')
  const [digits, setDigits] = useState('')

  const formatDigits = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  useEffect(() => {
    scannerRef.current?.focus()
  }, [])

  const performSearch = async (p: Prefix, d: string) => {
    if (d.length < 5) return
    const partner = await search(`${p}-${d}`)
    if (partner) {
      send({ type: 'FOUND', customer: partner })
      navigate('/productos')
    } else {
      send({ type: 'NOT_FOUND', vat: `${p}-${d}` })
      navigate('/registro')
    }
  }

  const handleConfirm = () => performSearch(prefix, digits)

  const handleScannerKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const raw = e.currentTarget.value.trim().toUpperCase()
    e.currentTarget.value = ''

    const withPrefix = raw.match(/^([VEJG])-?(\d{5,10})$/)
    const digitsOnly = raw.match(/^(\d{5,10})$/)

    if (withPrefix) {
      const p = withPrefix[1] as Prefix
      const d = withPrefix[2]
      setPrefix(p)
      setDigits(d)
      await performSearch(p, d)
    } else if (digitsOnly) {
      const d = digitsOnly[1]
      setDigits(d)
      await performSearch(prefix, d)
    }
  }

  return (
    <div className="kiosk-container">
      <input
        ref={scannerRef}
        type="text"
        aria-hidden="true"
        className={styles.scannerInput}
        onKeyDown={handleScannerKeyDown}
        readOnly={isPending}
      />
      <h2 className={styles.title}>¿Cuál es tu cédula o RIF?</h2>

      <div className={styles.prefixRow}>
        {PREFIXES.map(p => (
          <button
            key={p}
            type="button"
            className={`${styles.prefixBtn} ${prefix === p ? styles.active : ''}`}
            onClick={() => setPrefix(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <div className={styles.display}>
        {prefix}-{formatDigits(digits) || <span className={styles.placeholder}>__________</span>}
      </div>

      <AppNumericKeyboard value={digits} onChange={setDigits} maxLength={10} onConfirm={handleConfirm} />

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleConfirm}
          disabled={digits.length < 5 || isPending}
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
