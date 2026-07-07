import { useState, useEffect, useRef } from 'react'
import type { AdConfig } from '@/shared/types/types'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import styles from './WelcomeAd.module.css'

interface WelcomeAdProps {
  configs: AdConfig[]
  isMuted: boolean
  isLoading?: boolean
}

export function WelcomeAd({ configs, isMuted, isLoading }: WelcomeAdProps) {
  const activeConfigs = configs.filter(c => c.active)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const progressInterval = useRef<number | null>(null)

  // Reset index if the configs list changes to avoid out of bounds
  useEffect(() => {
    setCurrentIndex(0)
    setProgress(0)
  }, [activeConfigs.length])

  const currentAd = activeConfigs[currentIndex]
  const duration = currentAd?.type === 'video' ? 10000 : 5000 // 10s video, 5s static

  const handleNext = () => {
    setCurrentIndex((prev) => {
      if (activeConfigs.length === 0) return 0
      return (prev + 1) % activeConfigs.length
    })
  }

  const handlePrev = () => {
    setCurrentIndex((prev) => {
      if (activeConfigs.length === 0) return 0
      return (prev - 1 + activeConfigs.length) % activeConfigs.length
    })
  }

  // Reset progress and handle slide change
  useEffect(() => {
    if (!currentAd) return
    setProgress(0)

    if (progressInterval.current) {
      clearInterval(progressInterval.current)
    }

    const step = 100 // update every 100ms
    const totalSteps = duration / step
    let currentStep = 0

    progressInterval.current = window.setInterval(() => {
      currentStep++
      const percentage = (currentStep / totalSteps) * 100
      setProgress(percentage)

      if (currentStep >= totalSteps) {
        handleNext()
      }
    }, step)

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }
  }, [currentIndex, duration, activeConfigs.length])

  // Align video mute state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted
    }
  }, [isMuted, currentIndex])

  if (isLoading) {
    return (
      <div className={styles.adSkeleton}>
        <div className={styles.shimmer} />
      </div>
    )
  }

  if (activeConfigs.length === 0 || !currentAd) return null

  return (
    <div className={styles.adWrapper}>
      <div className={styles.adSliderRow}>
        <button
          type="button"
          className={styles.arrowBtn}
          onClick={handlePrev}
          aria-label="Anterior"
        >
          <CaretLeft size={36} weight="bold" />
        </button>

        <div className={styles.adContainer}>
          {/* Slide rendering */}
          {currentAd.type === 'video' ? (
            <video
              ref={videoRef}
              src={currentAd.url}
              className={styles.adVideo}
              autoPlay
              playsInline
              muted={isMuted}
            />
          ) : currentAd.type === 'image' ? (
            <img
              src={currentAd.url}
              alt={currentAd.title || "Publicidad"}
              className={styles.adImage}
            />
          ) : (
            <div 
              className={styles.adGradient}
              style={{
                background: `linear-gradient(135deg, ${currentAd.colorStart ?? '#059669'}, ${currentAd.colorEnd ?? '#10b981'})`
              }}
            />
          )}

          {/* Premium Content Overlay */}
          <div className={styles.contentOverlay}>
            <div className={styles.headerRow}>
              <span className={styles.adBadge}>RÁPIDO Y SEGURO</span>
            </div>
            
            {(currentAd.title || currentAd.description) && (
              <div className={styles.textInfo}>
                {currentAd.title && <h3 className={styles.adTitle}>{currentAd.title}</h3>}
                {currentAd.description && <p className={styles.adDesc}>{currentAd.description}</p>}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className={styles.arrowBtn}
          onClick={handleNext}
          aria-label="Siguiente"
        >
          <CaretRight size={36} weight="bold" />
        </button>
      </div>

      {/* Pagination Dots */}
      <div className={styles.dotsContainer}>
        {activeConfigs.map((_, index) => (
          <button
            key={index}
            type="button"
            className={`${styles.dot} ${index === currentIndex ? styles.activeDot : ''}`}
            onClick={() => setCurrentIndex(index)}
            aria-label={`Ir al anuncio ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
