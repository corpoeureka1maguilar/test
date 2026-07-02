import { useState } from 'react'
import { WifiSlash, ArrowClockwise } from '@phosphor-icons/react'
import { useConfigStore } from '@/shared/stores/config'
import styles from './OfflineOverlay.module.css'

export function OfflineOverlay() {
  const isOffline = useConfigStore((s) => s.isOffline)
  const isConfigured = useConfigStore((s) => s.isConfigured)
  const reauthenticate = useConfigStore((s) => s.reauthenticate)
  const [isRetrying, setIsRetrying] = useState(false)

  // Solo mostrar si el kiosko ya está configurado y el servidor está offline
  if (!isConfigured || !isOffline) return null

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
        
        <h1 className={styles.title}>Servidor fuera de línea</h1>
        
        <p className={styles.description}>
          El kiosco no puede establecer comunicación con el servidor central. 
          Por favor, verificá que el servidor esté encendido y conectado a la red.
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
