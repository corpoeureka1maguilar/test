import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { AppPinModal } from '@/features/payment/components/AppPinModal'
import { KIOSK_OPERATIONS } from '@/shared/lib/odooRepository'
import { SpeakerSimpleHigh, SpeakerSimpleSlash, List, ArrowRight } from '@phosphor-icons/react'
import { WelcomeAd } from '../components/WelcomeAd'
import { useAdvertisements } from '../hooks/useAdvertisements'
import type { AdConfig } from '@/shared/types/types'
import { useConfigStore } from '@/shared/stores/config'
import { useSessionStore } from '@/shared/stores/session'
import styles from './Welcome.module.css'

export function Welcome() {
  const { send } = useSaleMachine()
  const navigate = useNavigate()
  const [logoTaps, setLogoTaps] = useState(0)
  const [showPinModal, setShowPinModal] = useState(false)
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('autopay_muted') === 'true'
  })
  
  const isConfigured = useConfigStore((s) => s.isConfigured)
  const isConnectionReady = useConfigStore((s) => s.isConnectionReady)
  const stationId = useConfigStore((s) => s.stationId)
  const companyLogo = useConfigStore((s) => s.companyLogo)
  
  const sessionState = useSessionStore((s) => s.sessionState)
  const checkSession = useSessionStore((s) => s.checkSession)

  // Configuración de publicidad de respaldo (se usa mientras carga o si el backend no devuelve anuncios)
  const fallbackAdConfigs: AdConfig[] = [
    {
      type: 'image',
      url: '/ad_banner.png',
      title: 'FEX Autopago',
      description: 'La forma más inteligente y rápida de gestionar tus facturas en segundos.',
      active: true
    },
    {
      type: 'gradient',
      colorStart: '#0f172a',
      colorEnd: '#1e293b',
      title: '100% Digital y Seguro',
      description: 'Tus pagos están completamente encriptados y procesados de manera confiable.',
      active: true
    },
    {
      type: 'gradient',
      colorStart: '#064e3b',
      colorEnd: '#065f46',
      title: 'Evitá Filas de Espera',
      description: 'Comenzá ahora escaneando el código de barra de tu factura.',
      active: true
    }
  ]

  const { data: backendAdConfigs, isLoading: isLoadingAds } = useAdvertisements(isConnectionReady)
  const adConfigs = backendAdConfigs && backendAdConfigs.length > 0 ? backendAdConfigs : fallbackAdConfigs

  // Mientras la conexión no está lista, se muestra loading solo si el kiosko
  // ya está configurado (está esperando esa conexión); una vez lista, sigue
  // el estado de carga de los anuncios.
  const isLoading = isConnectionReady ? isLoadingAds : isConfigured

  // Verificar estado de sesión en Odoo apenas la conexión esté lista
  useEffect(() => {
    if (isConnectionReady && stationId) {
      void checkSession(stationId)
    }
  }, [isConnectionReady, stationId, checkSession])

  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Inicializar y reproducir el audio de bienvenida
    const audio = new Audio('/voices/bienvenido.mp3')
    audio.loop = false
    audioRef.current = audio

    if (localStorage.getItem('autopay_muted') !== 'true') {
      audio.play().catch((err) => {
        console.warn('El navegador previno la autoreproducción hasta la interacción:', err)
      })
    }

    return () => {
      audio.pause()
      audioRef.current = null
    }
  }, [])

  const toggleMute = () => {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    localStorage.setItem('autopay_muted', String(nextMuted))

    if (audioRef.current) {
      if (nextMuted) {
        audioRef.current.pause()
      } else {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(console.error)
      }
    }
  }

  const handleStart = () => {
    send({ type: 'START' })
    navigate('/cedula')
  }

  const handleLogoTap = () => {
    const next = logoTaps + 1
    setLogoTaps(next)
    if (next >= 5) {
      setLogoTaps(0)
      setShowPinModal(true)
    }
  }

  return (
    <main className={styles.wrapper}>
      <header className={styles.header}>
        {/* Botón de opciones avanzadas */}
        <button
          type="button"
          className={styles.advancedBtn}
          onClick={() => setShowPinModal(true)}
          aria-label="Opciones Avanzadas"
        >
          <List size={28} />
        </button>

        {/* Logo de la empresa */}
        {companyLogo && (
          <img
            src={`data:image/png;base64,${companyLogo}`}
            alt="Logo empresa"
            className={styles.companyLogo}
          />
        )}

        {/* Botón de mute */}
        <button
          type="button"
          className={styles.muteBtn}
          onClick={toggleMute}
          aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
        >
          {isMuted ? <SpeakerSimpleSlash size={32} /> : <SpeakerSimpleHigh size={32} />}
        </button>
      </header>

      <section className={styles.content}>
        <WelcomeAd configs={adConfigs} isMuted={isMuted} isLoading={isLoading} />

        <div className={styles.actions}>
          {sessionState === 'opened' ? (
            <button type="button" className={styles.mainBtn} onClick={handleStart}>
              INICIAR COMPRA
              <ArrowRight size={32} weight="bold" className={styles.btnIcon} />
            </button>
          ) : sessionState === 'checking' ? (
            <button type="button" className={styles.mainBtn} disabled>
              VERIFICANDO CAJA...
            </button>
          ) : (
            <div className={styles.closedWarningContainer}>
              <div className={styles.closedWarningTitle}>⚠️ CAJA CERRADA</div>
              <div className={styles.closedWarningDesc}>
                Se requiere la apertura de caja desde el menú de administración para poder operar.
              </div>
              <button type="button" className={styles.mainBtn} onClick={() => setShowPinModal(true)}>
                INGRESAR COMO SUPERVISOR
                <ArrowRight size={32} weight="bold" className={styles.btnIcon} />
              </button>
            </div>
          )}
        </div>
      </section>

      <footer className={styles.footer}>
        <button type="button" className={styles.logo} onClick={handleLogoTap}>
          <span className={styles.logoText}>FEX</span>
          <span className={styles.logoSub}>Autopago</span>
        </button>
      </footer>

      {showPinModal && (
        <AppPinModal
          operationRef={KIOSK_OPERATIONS.advancedAccess}
          onConfirmed={() => {
            setShowPinModal(false)
            // Si la caja está cerrada, navegamos indicando que vaya directo a la pestaña de cierres/sesión
            navigate('/advanced', {
              state: { defaultTab: sessionState === 'closed' ? 'cierres' : 'devoluciones' } 
            })
          }}
          onCancel={() => setShowPinModal(false)}
        />
      )}
    </main>
  )
}



