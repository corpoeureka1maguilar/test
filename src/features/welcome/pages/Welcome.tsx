import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaleMachine } from '@/features/payment/machines/SaleMachineContext'
import { AppPinModal } from '@/features/payment/components/AppPinModal'
import { KIOSK_OPERATIONS } from '@/shared/lib/odooRepository'
import { SpeakerSimpleHigh, SpeakerSimpleSlash, List, ArrowRight, Warning, CircleNotch } from '@phosphor-icons/react'
import { WelcomeAd } from '../components/WelcomeAd'
import { useAdvertisements } from '../hooks/useAdvertisements'
import type { AdConfig } from '@/shared/types/types'
import { useConfigStore } from '@/shared/stores/config'
import { useSessionStore } from '@/shared/stores/session'

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
  const isLoading = isConnectionReady ? isLoadingAds : isConfigured

  useEffect(() => {
    if (isConnectionReady && stationId) {
      void checkSession(stationId)
    }
  }, [isConnectionReady, stationId, checkSession])

  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
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

  const mainBtnClass =
    'flex items-center justify-center text-center w-[min(100%,540px)] h-[clamp(72px,9vh,92px)] desktop:w-[min(100%,460px)] px-10 text-[clamp(1.45rem,2.4vh,1.85rem)] font-extrabold tracking-wide rounded-full text-white select-none bg-[linear-gradient(180deg,#10b981_0%,#059669_50%,#047857_100%)] border border-[#047857] border-t-[#34d399] cursor-pointer shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-3px_0_rgba(0,0,0,0.25),0_8px_16px_rgba(4,120,87,0.25)] transition-transform duration-150 gap-3 active:scale-95 active:brightness-90 active:shadow-[inset_0_4px_6px_rgba(0,0,0,0.35)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:bg-slate-300'

  const iconBase = 'absolute transition-all duration-200 ease-out'
  const iconShown = 'opacity-100 scale-100 blur-0'
  const iconHidden = 'opacity-0 scale-50 blur-[4px]'

  return (
    <main className="h-dvh w-full grid grid-rows-[auto_minmax(0,1fr)_auto] relative overflow-hidden bg-white text-slate-900 select-none">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center w-full px-8 pt-6 pb-3 desktop:px-8 desktop:pt-5 desktop:pb-2 animate-fadeIn">
        <button
          type="button"
          className="justify-self-start shrink-0 bg-transparent border-none text-slate-500 rounded-full w-[52px] h-[52px] flex items-center justify-center cursor-pointer transition-transform duration-150 active:scale-90 active:text-slate-900"
          onClick={() => setShowPinModal(true)}
          aria-label="Opciones Avanzadas"
        >
          <List size={28} />
        </button>

        {companyLogo && (
          <img
            src={`data:image/png;base64,${companyLogo}`}
            alt="Logo empresa"
            className="h-[clamp(64px,8vh,130px)] w-auto max-w-[min(60vw,400px)] object-contain"
          />
        )}

        <button
          type="button"
          className="justify-self-end shrink-0 bg-transparent border-none text-slate-500 cursor-pointer w-[52px] h-[52px] rounded-full flex items-center justify-center transition-transform duration-150 active:scale-90 active:text-slate-900"
          onClick={toggleMute}
          aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
        >
          <span className="relative w-8 h-8 grid place-items-center">
            <SpeakerSimpleHigh size={30} className={`${iconBase} ${isMuted ? iconHidden : iconShown} text-emerald-600`} />
            <SpeakerSimpleSlash size={30} className={`${iconBase} ${isMuted ? iconShown : iconHidden} text-slate-400`} />
          </span>
        </button>
      </header>

      <section className="min-h-0 px-6 py-1 flex items-center justify-center animate-fadeIn">
        <WelcomeAd configs={adConfigs} isMuted={isMuted} isLoading={isLoading} />
      </section>

      <footer className="flex flex-col items-center gap-[clamp(0.75rem,2vh,1.5rem)] px-6 pt-[clamp(1rem,2.5vh,2rem)] pb-[clamp(1.25rem,3vh,2.5rem)] animate-fadeIn">
        {sessionState === 'opened' ? (
          <button type="button" className={mainBtnClass} onClick={handleStart}>
            INICIAR COMPRA
            <ArrowRight size={32} weight="bold" />
          </button>
        ) : sessionState === 'checking' ? (
          <button type="button" className={mainBtnClass} disabled>
            <CircleNotch size={28} className="animate-spin text-white/80" />
            VERIFICANDO CAJA...
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-[2rem] p-6 flex flex-col gap-3 items-center w-[min(100%,580px)]">
            <div className="flex flex-col gap-1 items-center text-center">
              <div className="inline-flex items-center gap-2 text-lg font-extrabold text-red-600 uppercase">
                <Warning size={28} weight="fill" className="text-red-500" /> CAJA CERRADA
              </div>
              <p className="text-sm text-slate-600 max-w-[420px] leading-relaxed">
                Se requiere la apertura de caja desde el panel de administración para poder operar.
              </p>
            </div>
            <button type="button" className={mainBtnClass} onClick={() => setShowPinModal(true)}>
              INGRESAR COMO SUPERVISOR
              <ArrowRight size={28} weight="bold" />
            </button>
          </div>
        )}

        <button
          type="button"
          className="flex flex-col items-center bg-transparent border-none cursor-pointer gap-0.5 transition-transform duration-150 active:scale-95 focus:outline-none"
          onClick={handleLogoTap}
        >
          <span className="text-[clamp(2.25rem,4.5vh,3.5rem)] font-black text-slate-900 tracking-tighter leading-none">
            FEX
          </span>
          <span className="text-[0.75rem] text-emerald-600 tracking-[0.5em] uppercase font-bold ml-[0.5em]">
            Autopago
          </span>
        </button>
      </footer>

      {showPinModal && (
        <AppPinModal
          operationRef={KIOSK_OPERATIONS.advancedAccess}
          onConfirmed={() => {
            setShowPinModal(false)
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







