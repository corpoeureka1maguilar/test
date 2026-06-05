import { useEffect, useRef } from 'react'

export function useInactivityTimer(delayMs: number, onInactive: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(onInactive, delayMs)
    }

    const events = ['pointermove', 'pointerdown', 'keydown', 'touchstart']
    events.forEach((e) => window.addEventListener(e, reset))
    reset()

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [delayMs, onInactive])
}
