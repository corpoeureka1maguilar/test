import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { AppPinModal } from '@/features/payment/components/AppPinModal'
import { SpeakerSimpleHigh, SpeakerSimpleSlash } from '@phosphor-icons/react'
import { WelcomeAd } from '../components/WelcomeAd'
import type { AdConfig } from '@/shared/types/types'
import { fetchAdvertisements } from '@/shared/lib/odooRepository'
import { useConfigStore } from '@/shared/stores/config'
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
  
  const [isLoading, setIsLoading] = useState(() => {
    return isConfigured && !isConnectionReady
  })

  
  // Configuración de publicidad simulada con fallback local
  const [adConfigs, setAdConfigs] = useState<AdConfig[]>([
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
  ])

  useEffect(() => {
    if (!isConnectionReady) {
      if (!isConfigured) {
        setIsLoading(false)
      }
      return
    }
    
    let active = true
    setIsLoading(true)
    fetchAdvertisements()
      .then((backendAds) => {
        if (!active) return
        if (backendAds && backendAds.length > 0) {
          setAdConfigs(backendAds)
        }
      })
      .catch((err) => {
        console.warn('No se pudieron cargar los anuncios del backend, usando locales:', err)
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [isConnectionReady, isConfigured])



  
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

        

        {/* <div className={styles.hero}>
          <h1 className={styles.headline}>La mejor forma<br/>de pagar.</h1>
          <p className={styles.sub}>Rápido, seguro y totalmente digital. Pagá tu factura en segundos.</p>
        </div> */}

        <div className={styles.actions}>
          <button type="button" className={styles.mainBtn} onClick={handleStart}>
            COMENZAR
          </button>
          
          <button
            type="button"
            className={styles.devolucionBtn}
            onClick={() => setShowPinModal(true)}
          >
            Opciones Avanzadas
          </button>
        </div>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.logo} onClick={handleLogoTap}>
          <span className={styles.logoText}>FEX</span>
          <span className={styles.logoSub}>Autopago</span>
        </button>
        <div className={styles.partners}>
          <span className={styles.partnerLabel}>Desarrollado por</span>
          <span className={styles.partnerName}>CorpoEureka</span>
        </div>
      </div>

      {showPinModal && (
        <AppPinModal
          onConfirmed={() => {
            setShowPinModal(false)
            navigate('/devolucion')
          }}
          onCancel={() => setShowPinModal(false)}
        />
      )}
    </div>
  )
}


