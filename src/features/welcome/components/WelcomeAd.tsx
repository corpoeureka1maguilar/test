import { useState, useEffect, useRef } from 'react'
import type { AdConfig } from '@/shared/types/types'
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

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = x / rect.width
    if (percent < 0.3) {
      handlePrev()
    } else {
      handleNext()
    }
  }

  return (
    <div className={styles.adContainer} onClick={handleTap}>
      {/* Instagram-style progress indicators */}
      <div className={styles.progressHeader}>
        {activeConfigs.map((_, index) => {
          let width = '0%'
          if (index < currentIndex) width = '100%'
          if (index === currentIndex) width = `${progress}%`

          return (
            <div key={index} className={styles.progressBarBg}>
              <div 
                className={styles.progressBarFill} 
                style={{ width }} 
              />
            </div>
          )
        })}
      </div>

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
          <span className={styles.adBadge}>Patrocinado</span>
        </div>
        
        {(currentAd.title || currentAd.description) && (
          <div className={styles.textInfo}>
            {currentAd.title && <h3 className={styles.adTitle}>{currentAd.title}</h3>}
            {currentAd.description && <p className={styles.adDesc}>{currentAd.description}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
