import { useState, useCallback } from 'react'
import { useConfigStore } from '@/shared/stores/config'
import { AppNumericKeyboard } from '@/shared/components/AppNumericKeyboard'
import styles from './AppPinModal.module.css'

interface Props {
  title?: string
  onConfirmed: () => void
  onCancel: () => void
}

const MAX_ATTEMPTS = 3
const LOCKOUT_MS = 30_000

export function AppPinModal({ title = 'Acceso de administrador', onConfirmed, onCancel }: Props) {
  const verifyPin = useConfigStore((s) => s.verifyPin)
  const [pin, setPin] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [shake, setShake] = useState(false)

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil
  const remaining = lockedUntil ? Math.ceil((lockedUntil - Date.now()) / 1000) : 0

  const handleConfirm = useCallback(async () => {
    if (isLocked || pin.length === 0) return

    const ok = await verifyPin(pin)
    if (ok) {
      onConfirmed()
      return
    }

    const next = attempts + 1
    setAttempts(next)
    setPin('')
    setShake(true)
    setTimeout(() => setShake(false), 400)

    if (next >= MAX_ATTEMPTS) {
      setLockedUntil(Date.now() + LOCKOUT_MS)
      setAttempts(0)
    }
  }, [pin, attempts, isLocked, verifyPin, onConfirmed])

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} ${shake ? styles.shake : ''}`}>
        <h2 className={styles.title}>{title}</h2>

        {isLocked ? (
          <p className={styles.locked}>Bloqueado. Intentá de nuevo en {remaining}s</p>
        ) : (
          <>
            {attempts > 0 && (
              <p className={styles.error}>PIN incorrecto. {MAX_ATTEMPTS - attempts} intento(s) restante(s)</p>
            )}
            <AppNumericKeyboard value={pin} onChange={setPin} maxLength={6} masked />
            <div className={styles.actions}>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={pin.length === 0}>
                Confirmar
              </button>
              <button className="btn btn-secondary" onClick={onCancel}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
