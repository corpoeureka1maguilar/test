import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { AppPinModal } from '@/features/payment/components/AppPinModal'
import { SpeakerSimpleHigh, SpeakerSimpleSlash, List } from '@phosphor-icons/react'
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

  const [isLoading, setIsLoading] = useState(() => {
    return isConfigured && !isConnectionReady
  })

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

  useEffect(() => {
    if (!isConnectionReady) {
      if (!isConfigured) {
        setIsLoading(false)
      }
      return
    }

    // Verificar estado de sesión en Odoo
    if (stationId) {
      checkSession(stationId)
    }

    setIsLoading(isLoadingAds)
  }, [isConnectionReady, isConfigured, isLoadingAds, stationId, checkSession])

  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Inicializar y reproducir el audio de bienvenida
    const audio = new Audio('/voices/bienvenido.mp3')
    audio.loop = false
    audioRef.current = audio

    if (!isMuted) {
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
    <div className={styles.wrapper}>
      {/* Botón de opciones avanzadas oculto en la esquina superior izquierda */}
      <button
        type="button"
        className={styles.advancedBtn}
        onClick={() => setShowPinModal(true)}
        title="Opciones Avanzadas"
      >
        <List size={28} />
      </button>

      {/* Botón de mute minimalista y premium en la esquina superior derecha */}
      <button
        type="button"
        className={styles.muteBtn}
        onClick={toggleMute}
        title={isMuted ? 'Activar sonido' : 'Silenciar'}
      >
        {isMuted ? <SpeakerSimpleSlash size={32} /> : <SpeakerSimpleHigh size={32} />}
      </button>

      <div className={styles.content}>
        <WelcomeAd configs={adConfigs} isMuted={isMuted} isLoading={isLoading} />

        <div className={styles.actions}>
          {sessionState === 'opened' ? (
            <button type="button" className={styles.mainBtn} onClick={handleStart}>
              INICIAR COMPRA
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
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <img
          src={companyLogo ? `data:image/png;base64,${companyLogo}` : undefined}
          alt="Logo empresa"
          className={styles.companyLogo}
          style={{ visibility: companyLogo ? 'visible' : 'hidden' }}
        />
        <div className={styles.footerBranding}>
          <button type="button" className={styles.logo} onClick={handleLogoTap}>
            <span className={styles.logoText}>FEX</span>
            <span className={styles.logoSub}>Autopago</span>
          </button>
          <div className={styles.partners}>
            <span className={styles.partnerLabel}>Desarrollado por</span>
            <span className={styles.partnerName}>CorpoEureka</span>
          </div>
        </div>
      </div>

      {showPinModal && (
        <AppPinModal
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
    </div>
  )
}



