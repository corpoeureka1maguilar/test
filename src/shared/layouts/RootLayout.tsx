import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useInactivityTimer } from '@/shared/hooks/useInactivityTimer'
import { AppStepper } from '@/features/cart/components/AppStepper'
import { AppInactivityModal } from '@/shared/components/AppInactivityModal'
import { useCartStore } from '@/features/cart/stores/cart'
import { trackView, trackViewDuration } from '@/shared/lib/metrics'

const INACTIVITY_WARNING_MS = 60_000
const INACTIVITY_COUNTDOWN_S = 30

export function RootLayout() {
  const { state, send } = useSaleMachine()
  const navigate = useNavigate()
  const location = useLocation()
  const [showInactivityWarning, setShowInactivityWarning] = useState(false)

  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  const resetKiosk = useCallback(() => {
    setShowInactivityWarning(false)
    // El carrito está persistido en localStorage: si no se limpia acá, el
    // próximo cliente heredaría los productos de la compra abandonada
    useCartStore.getState().clearCart()
    send({ type: 'RESET' })
    navigate('/')
  }, [send, navigate])

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
    } else if (state === 'paymentError') {
      playSound('/voices/4.2.pago_rechazado.mp3')
    }
  }, [state])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppStepper />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </div>
      {showInactivityWarning && (
        <AppInactivityModal
          seconds={INACTIVITY_COUNTDOWN_S}
          onContinue={() => setShowInactivityWarning(false)}
          onTimeout={resetKiosk}
        />
      )}
    </div>
  )
}

