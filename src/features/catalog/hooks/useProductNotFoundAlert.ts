import { useEffect, useState } from 'react'

/** Toast de "producto no encontrado" que se auto-descarta a los 2.5s */
export function useProductNotFoundAlert() {
  const [showNotFoundAlert, setShowNotFoundAlert] = useState(false)
  const [notFoundCode, setNotFoundCode] = useState('')

  // Auto-dismiss not found alert after 2.5 seconds
  useEffect(() => {
    if (showNotFoundAlert) {
      const timer = setTimeout(() => {
        setShowNotFoundAlert(false)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [showNotFoundAlert, notFoundCode])

  const triggerNotFound = (code: string) => {
    setNotFoundCode(code)
    setShowNotFoundAlert(true)
  }

  return { showNotFoundAlert, notFoundCode, triggerNotFound }
}
