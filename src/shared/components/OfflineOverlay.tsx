import { useState } from 'react'
import { WifiSlash, ArrowClockwise } from '@phosphor-icons/react'
import { useConfigStore } from '@/shared/stores/config'
import { useShouldBlockUI } from '@/shared/hooks/useShouldBlockUI'
import styles from './OfflineOverlay.module.css'

export function OfflineOverlay() {
  const reauthenticate = useConfigStore((s) => s.reauthenticate)
  const [isRetrying, setIsRetrying] = useState(false)

  // Solo bloquea cuando offline Y la cola local está llena (design ADR-4):
  // mientras haya cupo, el kiosko sigue vendiendo offline sin interrupciones
  const shouldBlockUI = useShouldBlockUI()
  if (!shouldBlockUI) return null

  const handleRetry = async () => {
    if (isRetrying) return
    setIsRetrying(true)
    try {
      await reauthenticate()
    } catch (err) {
      console.warn('Reintento manual de conexión fallido:', err)
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.iconContainer}>
          <WifiSlash size={64} className={styles.icon} />
          <div className={styles.pulseRing} />
        </div>
        
        <h1 className={styles.title}>Cola de ventas offline llena</h1>

        <p className={styles.description}>
          El servidor central sigue fuera de línea y este kiosco ya alcanzó el
          máximo de ventas que puede guardar localmente. No se pueden registrar
          más ventas hasta reconectar y sincronizar la cola pendiente.
        </p>

        <div className={styles.statusBox}>
          <span className={styles.pulseDot} />
          <span>Intentando reconectar automáticamente...</span>
        </div>

        <button 
          type="button" 
          className={styles.retryBtn} 
          onClick={handleRetry}
          disabled={isRetrying}
        >
          <ArrowClockwise size={20} className={isRetrying ? styles.spin : ''} />
          {isRetrying ? 'Conectando...' : 'Reintentar conexión'}
        </button>
      </div>
    </div>
  )
}
