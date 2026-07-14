import { useRef, useState, useEffect } from 'react'
import { useDebounce } from '@/shared/hooks/useDebounce'

/**
 * Maneja el input de escaneo/búsqueda: el estado de texto, el debounce,
 * el modo manual vs. escáner físico, el teclado en pantalla, y el
 * auto-foco necesario para capturar la entrada del lector físico.
 */
export function useBarcodeScanner() {
  const searchRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)

  const [isManualMode, setIsManualMode] = useState(false)
  const [showKeyboard, setShowKeyboard] = useState(false)
  const [isKeyboardMinimized, setIsKeyboardMinimized] = useState(false)

  // Auto-focus barcode input on mount and mode changes
  useEffect(() => {
    const timer = setTimeout(() => {
      searchRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [isManualMode])

  // Mantener enfocado el input para la lectura del scanner cuando no está en modo manual
  useEffect(() => {
    if (isManualMode) return
    const interval = setInterval(() => {
      if (document.activeElement !== searchRef.current) {
        searchRef.current?.focus()
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [isManualMode])

  // Refocus on barcode input for physical scanner input capture
  const handleWrapperClick = () => {
    searchRef.current?.focus()
  }

  return {
    searchRef,
    search,
    setSearch,
    debouncedSearch,
    isManualMode,
    setIsManualMode,
    showKeyboard,
    setShowKeyboard,
    isKeyboardMinimized,
    setIsKeyboardMinimized,
    handleWrapperClick
  }
}
