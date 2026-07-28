import { useState, useEffect, useCallback, useRef } from 'react'
import type { AdConfig } from '@/shared/types/types'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'

interface WelcomeAdProps {
  configs: AdConfig[]
  isMuted: boolean
  isLoading?: boolean
}

const SLOT = 'relative h-full max-h-full aspect-[9/16] rounded-[2rem] overflow-hidden border border-slate-200/80 shadow-lg bg-black'

const NAV_BTN =
  'absolute top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full flex items-center justify-center cursor-pointer border border-white/40 text-white bg-black/40 backdrop-blur-md shadow-md transition-transform duration-150 active:scale-90 active:bg-black/70'

export function WelcomeAd({ configs, isMuted, isLoading }: WelcomeAdProps) {
  const activeConfigs = configs.filter(c => c.active)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const progressInterval = useRef<number | null>(null)

  const [prevConfigsLength, setPrevConfigsLength] = useState(activeConfigs.length)
  if (activeConfigs.length !== prevConfigsLength) {
    setPrevConfigsLength(activeConfigs.length)
    setCurrentIndex(0)
  }

  const currentAd = activeConfigs[currentIndex]
  const duration = currentAd?.type === 'video' ? 10000 : 5000

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => {
      if (activeConfigs.length === 0) return 0
      return (prev + 1) % activeConfigs.length
    })
  }, [activeConfigs.length])

  const handlePrev = () => {
    setCurrentIndex((prev) => {
      if (activeConfigs.length === 0) return 0
      return (prev - 1 + activeConfigs.length) % activeConfigs.length
    })
  }

  useEffect(() => {
    if (!currentAd) return

    setProgress(0)

    if (progressInterval.current) {
      clearInterval(progressInterval.current)
    }

    const step = 50
    const totalSteps = duration / step
    let currentStep = 0

    progressInterval.current = window.setInterval(() => {
      currentStep++
      const pct = Math.min(100, (currentStep / totalSteps) * 100)
      setProgress(pct)

      if (currentStep >= totalSteps) {
        handleNext()
      }
    }, step)

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }
  }, [currentIndex, duration, activeConfigs.length, currentAd, handleNext])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted
    }
  }, [isMuted, currentIndex])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center min-h-0">
        <div className={`${SLOT} bg-slate-100`}>
          <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.6)_50%,rgba(255,255,255,0)_100%)]" />
        </div>
      </div>
    )
  }

  if (activeConfigs.length === 0 || !currentAd) return null

  return (
    <div className="flex h-full items-center justify-center min-h-0">
      <div className={SLOT}>
        {/* Fondo del Anuncio */}
        <div className="relative w-full h-full overflow-hidden bg-black">
          {currentAd.type === 'video' ? (
            <video
              ref={videoRef}
              src={currentAd.url}
              className="w-full h-full object-cover block"
              autoPlay
              playsInline
              muted={isMuted}
            />
          ) : currentAd.type === 'image' ? (
            <img
              src={currentAd.url}
              alt={currentAd.title || "Publicidad"}
              className="w-full h-full object-cover block"
            />
          ) : (
            <div
              className="w-full h-full block"
              style={{
                background: `linear-gradient(135deg, ${currentAd.colorStart ?? '#065f46'}, ${currentAd.colorEnd ?? '#10b981'})`
              }}
            />
          )}

          {/* Sombra para contraste del texto */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/75 z-10 pointer-events-none" />
        </div>

        {/* Overlay de Contenido */}
        <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 pointer-events-none">
          {/* Indicadores de progreso */}
          {activeConfigs.length > 1 && (
            <div className="flex items-center gap-1.5 pointer-events-auto">
              {activeConfigs.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className="flex-1 h-1.5 rounded-full bg-white/35 overflow-hidden cursor-pointer transition-all border-none p-0"
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`Ver anuncio ${index + 1}`}
                >
                  <div
                    className="h-full bg-white rounded-full transition-all ease-linear"
                    style={{
                      width:
                        index < currentIndex
                          ? '100%'
                          : index === currentIndex
                          ? `${progress}%`
                          : '0%'
                    }}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Título y Descripción */}
          {(currentAd.title || currentAd.description) && (
            <div className="flex flex-col gap-2 mt-auto animate-fadeIn">
              {currentAd.title && (
                <h3 className="text-white text-[clamp(1.4rem,2.8vh,2rem)] font-bold m-0 leading-tight text-balance">
                  {currentAd.title}
                </h3>
              )}
              {currentAd.description && (
                <p className="text-white/90 text-[clamp(0.9rem,1.6vh,1.1rem)] font-normal m-0 leading-snug text-pretty">
                  {currentAd.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Botones de navegación */}
        {activeConfigs.length > 1 && (
          <>
            <button type="button" className={`${NAV_BTN} left-3`} onClick={handlePrev} aria-label="Anterior">
              <CaretLeft size={22} weight="bold" />
            </button>
            <button type="button" className={`${NAV_BTN} right-3`} onClick={handleNext} aria-label="Siguiente">
              <CaretRight size={22} weight="bold" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}



