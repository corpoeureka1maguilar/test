import { useCallback, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { useInactivityTimer } from '@/shared/hooks/useInactivityTimer'
import { AppStepper } from '@/features/cart/components/AppStepper'

export function RootLayout() {
  const { state, send } = useSaleMachine()
  const navigate = useNavigate()
  const location = useLocation()
  
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  const handleInactive = useCallback(() => {
    send({ type: 'RESET' })
    navigate('/')
  }, [send, navigate])

  useInactivityTimer(90_000, handleInactive)

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

  // Escuchar cambios de ruta para reproducir audios de cada paso
  useEffect(() => {
    const path = location.pathname

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
    </div>
  )
}

