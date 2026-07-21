import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useInactivityTimer } from '@/shared/hooks/useInactivityTimer'
import { AppStepper } from '@/features/cart/components/AppStepper'
import { AppInactivityModal } from '@/shared/components/AppInactivityModal'
import { useCartStore } from '@/features/cart/stores/cart'
import { getMetrics, trackView, trackViewDuration } from '@/shared/lib/metrics'
import { syncMetrics } from '@/shared/lib/odooRepository'
import { useConfigStore } from '@/shared/stores/config'
import { OfflineOverlay } from '@/shared/components/OfflineOverlay'
import { AppVirtualKeyboard } from '@/shared/components/AppVirtualKeyboard'
import styles from './RootLayout.module.css'

const INACTIVITY_WARNING_MS = 60_000
const INACTIVITY_COUNTDOWN_S = 30
const METRICS_SYNC_INTERVAL_MS = 10 * 60 * 1000

export function RootLayout() {
  const { state, send } = useSaleMachine()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [showInactivityWarning, setShowInactivityWarning] = useState(false)

  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  const resetKiosk = useCallback(() => {
    setShowInactivityWarning(false)
    // El carrito está persistido en localStorage: si no se limpia acá, el
    // próximo cliente heredaría los productos de la compra abandonada
    useCartStore.getState().clearCart()
    send({ type: 'RESET' })
    // La compra cancelada puede haber dejado precios/stock cacheados; el
    // próximo cliente debe arrancar con datos frescos, no con lo que quedó en caché
    queryClient.invalidateQueries({ queryKey: ['products'] })
    navigate('/')
  }, [send, navigate, queryClient])

  const handleInactive = useCallback(() => {
    if (showInactivityWarning) return

    // Solo tiene sentido preguntar si hay una compra en curso; en el home
    // idle no hay nada que perder y el modal molestaría al próximo cliente
    const purchaseInProgress = state !== 'idle' || useCartStore.getState().items.length > 0
    if (purchaseInProgress) {
      setShowInactivityWarning(true)
    }
  }, [state, showInactivityWarning])

  useInactivityTimer(INACTIVITY_WARNING_MS, handleInactive)

  const playSound = (src: string) => {
    const isMuted = localStorage.getItem('autopay_muted') === 'true'
    if (isMuted) return

    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
    }

    const audio = new Audio(src)
    currentAudioRef.current = audio
    audio.play().catch((err) => {
      console.warn('El navegador previno la reproducción del audio:', err)
    })
  }

  // Escuchar cambios de ruta para reproducir audios de cada paso e ir registrando métricas
  useEffect(() => {
    const path = location.pathname
    trackView(path)

    if (path === '/cedula') {
      playSound('/voices/1.documento.mp3')
    } else if (path === '/productos') {
      playSound('/voices/2.productos.mp3')
    } else if (path === '/pago') {
      playSound('/voices/3.pagar.mp3')
    }

    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
      }
    }
  }, [location.pathname])

  // Escuchar cambios de ruta para registrar el tiempo que pasa el usuario en cada vista
  useEffect(() => {
    const startTime = Date.now()
    const path = location.pathname

    return () => {
      const endTime = Date.now()
      const durationSeconds = Math.round((endTime - startTime) / 1000)
      if (durationSeconds > 0) {
        trackViewDuration(path, durationSeconds)
      }
    }
  }, [location.pathname])

  // Escuchar cambios en el estado de la Sale Machine (éxito/error)
  useEffect(() => {
    if (state === 'success') {
      playSound('/voices/4.exito.mp3')
    } else if (state === 'paymentError' || state === 'printingError') {
      playSound('/voices/4.2.pago_rechazado.mp3')
    }
  }, [state])

  // Sincroniza periódicamente el snapshot de métricas locales con Odoo, para
  // no perderlas si el kiosco se resetea o queda sin memoria persistente
  useEffect(() => {
    const syncNow = () => {
      const { stationId, branchId, isConnectionReady } = useConfigStore.getState()
      if (!isConnectionReady || !stationId) return
      syncMetrics(stationId, branchId, getMetrics()).catch((err) => {
        console.error('Error sincronizando métricas con Odoo:', err)
      })
    }

    syncNow()
    const interval = setInterval(syncNow, METRICS_SYNC_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={styles.wrapper}>
      <AppStepper />
      <div className={styles.content}>
        <Outlet />
      </div>
      <div className={styles.footer}>
        Desarrollado por <strong>CorpoEureka</strong>
      </div>
      {showInactivityWarning && (
        <AppInactivityModal
          seconds={INACTIVITY_COUNTDOWN_S}
          onContinue={() => setShowInactivityWarning(false)}
          onCancel={resetKiosk}
          onTimeout={resetKiosk}
        />
      )}
      <OfflineOverlay />
      <AppVirtualKeyboard />
    </div>
  )
}

