import { useEffect, useState } from 'react'
import styles from './AppInactivityModal.module.css'

interface Props {
  seconds: number
  onContinue: () => void
  onCancel: () => void
  onTimeout: () => void
}

export function AppInactivityModal({ seconds, onContinue, onCancel, onTimeout }: Props) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => r - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // onTimeout se dispara desde un efecto (no dentro del setInterval) para no
  // ejecutar side effects del padre durante el render de este componente
  useEffect(() => {
    if (remaining <= 0) onTimeout()
  }, [remaining, onTimeout])

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="alertdialog" aria-labelledby="inactivity-title">
        <h2 id="inactivity-title" className={styles.title}>¿Sigues allí?</h2>
        <p className={styles.message}>Tu compra se cancelará por inactividad en</p>
        <span className={styles.countdown}>{Math.max(remaining, 0)}</span>
        <div className={styles.actions}>
          <button className="btn btn-primary" onClick={onContinue}>
            Sí, continuar con mi compra
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            No, cancelar compra
          </button>
        </div>
      </div>
    </div>
  )
}
