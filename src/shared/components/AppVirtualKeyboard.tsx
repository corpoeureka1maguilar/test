import { useState, useEffect, useRef } from 'react'
import styles from './AppVirtualKeyboard.module.css'

interface AppVirtualKeyboardProps {
  value?: string
  onChange?: (value: string) => void
  onClose?: () => void
  onEnter?: () => void
  layoutType?: 'text' | 'tel'
  isMinimized?: boolean
  onMinimizeChange?: (minimized: boolean) => void
}

export function AppVirtualKeyboard(props: AppVirtualKeyboardProps) {
  // Check if this is a local instance rendered by a page
  const isLocalInstance = props.value !== undefined

  const [localValue, setLocalValue] = useState('')
  const [localLayoutType, setLocalLayoutType] = useState<'text' | 'tel'>('text')
  const [isVisible, setIsVisible] = useState(false)
  const [isShift, setIsShift] = useState(false) // Start capitalized for premium feel
  const [isAlt, setIsAlt] = useState(false)
  const [internalMinimized, setInternalMinimized] = useState(false)
  const lastInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  // 1. Manage layout height via CSS variable dynamically
  useEffect(() => {
    if (isLocalInstance) return

    const height = isVisible ? (internalMinimized ? '80px' : '320px') : '0px'
    document.documentElement.style.setProperty('--keyboard-height', height)
    return () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px')
    }
  }, [isVisible, internalMinimized, isLocalInstance])

  // 2. Globally capture input focus to expand the keyboard and track the active element
  useEffect(() => {
    if (isLocalInstance) return

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
        !(target as HTMLInputElement).readOnly &&
        (target as HTMLInputElement).type !== 'hidden' &&
        (target as HTMLInputElement).type !== 'checkbox' &&
        (target as HTMLInputElement).type !== 'radio'
      ) {
        const input = target as HTMLInputElement | HTMLTextAreaElement
        
        // Ignore programmatically focused scanner inputs or hidden inputs
        const style = window.getComputedStyle(input)
        if (style.opacity === '0' || style.display === 'none' || style.visibility === 'hidden') {
          return
        }

        // Suppress system mobile/OS keyboard
        input.inputMode = 'none'

        lastInputRef.current = input
        setLocalValue(input.value)

        // Determine layout based on input properties
        const isNumeric = 
          input.type === 'tel' || 
          input.type === 'number' || 
          input.getAttribute('inputmode') === 'numeric' ||
          input.getAttribute('inputmode') === 'tel' ||
          input.placeholder.toLowerCase().includes('tel') ||
          input.name.toLowerCase().includes('phone') ||
          input.name.toLowerCase().includes('referencia') ||
          input.name.toLowerCase().includes('comprobante')

        setLocalLayoutType(isNumeric ? 'tel' : 'text')
        setInternalMinimized(false)
        setIsVisible(true)
      }
    }

    const handleBlur = () => {
      setTimeout(() => {
        const activeEl = document.activeElement
        const clickedKeyboard = activeEl && (
          activeEl.closest(`.${styles.wrapper}`) || 
          activeEl.tagName === 'BUTTON'
        )
        if (!clickedKeyboard && activeEl?.tagName !== 'INPUT' && activeEl?.tagName !== 'TEXTAREA') {
          setInternalMinimized(true)
        }
      }, 150)
    }

    document.addEventListener('focusin', handleFocus)
    document.addEventListener('focusout', handleBlur)
    return () => {
      document.removeEventListener('focusin', handleFocus)
      document.removeEventListener('focusout', handleBlur)
    }
  }, [isLocalInstance])

  // 3. Listen to input events to keep value state synchronized in real time (e.g. barcode scanner)
  useEffect(() => {
    if (isLocalInstance) return

    const handleInputEvent = (e: Event) => {
      if (lastInputRef.current && e.target === lastInputRef.current) {
        setLocalValue(lastInputRef.current.value)
      }
    }
    document.addEventListener('input', handleInputEvent)
    return () => {
      document.removeEventListener('input', handleInputEvent)
    }
  }, [isLocalInstance])

  // Local returns
  if (isLocalInstance) return null
  if (!isVisible) return null

  const isMinimized = internalMinimized
  const layoutType = localLayoutType

  // const handleExpand = () => {
  //   setInternalMinimized(false)
  //   setTimeout(() => {
  //     if (lastInputRef.current) {
  //       lastInputRef.current.focus()
  //     }
  //   }, 50)
  // }

  const updateInputValue = (newValue: string) => {
    if (lastInputRef.current) {
      setLocalValue(newValue)

      const activeInput = lastInputRef.current
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        activeInput.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype,
        'value'
      )?.set
      nativeInputValueSetter?.call(activeInput, newValue)

      // Bubble event to let React/framework detect input value change
      activeInput.dispatchEvent(new Event('input', { bubbles: true }))
      activeInput.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  const handleKeyClick = (key: string) => {
    const currentValue = localValue

    if (key === 'SHIFT') {
      setIsShift(s => !s)
      return
    }
    if (key === 'ALT') {
      setIsAlt(a => !a)
      return
    }

    let newValue = currentValue
    if (key === 'BACKSPACE') {
      newValue = currentValue.slice(0, -1)
    } else if (key === 'SPACE') {
      newValue = currentValue + ' '
    } else if (key === 'ENTER') {
      if (lastInputRef.current) {
        lastInputRef.current.blur()
        lastInputRef.current.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      }
      setInternalMinimized(true)
      return
    } else if (key === 'CLOSE') {
      if (lastInputRef.current) lastInputRef.current.blur()
      setIsVisible(false)
      return
    } else {
      let char = key
      if (localLayoutType === 'text' && !isAlt) {
        char = isShift ? key.toUpperCase() : key.toLowerCase()
      }
      newValue = currentValue + char
    }

    updateInputValue(newValue)
  }

  // Keyboard layout configurations
  const textLayoutNormal = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
    ['SHIFT', 'z', 'x', 'c', 'v', 'b', 'n', 'm','.', 'BACKSPACE'],
    ['ALT', 'SPACE', 'ENTER']
  ]

  const textLayoutAlt = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['@', '#', '$', '%', '&', '-', '_', '+', '(', ')'],
    ['ALT', '/', '*', '"', "'", ':', ';', '!', '?', 'BACKSPACE'],
    ['SPACE', 'ENTER']
  ]

  const telLayout = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['-', '0', 'BACKSPACE'],
    ['ENTER']
  ]

  const currentLayout = layoutType === 'tel' 
    ? telLayout 
    : (isAlt ? textLayoutAlt : textLayoutNormal)

  if (isMinimized) {
    return null 

    // return (
    //   <div 
    //     className={`${styles.wrapper} ${styles.minimized}`} 
    //     onClick={handleExpand}
    //     onMouseDown={(e) => e.preventDefault()}
    //     title="Mostrar teclado"
    //   >
    //     <div className={styles.minimizedContent}>
    //       <span className={styles.minimizedIcon}>⌨️</span>
    //       <span className={styles.minimizedText}>Teclado minimizado (Tocar para expandir)</span>
    //     </div>
    //   </div>
    // )
  }

  return (
    <div className={styles.wrapper} data-layout={layoutType}>
      {/* Sleek top header handle bar for quick minimizing */}
      <div className={styles.headerBar} onClick={() => setInternalMinimized(true)} role="button" aria-label="Minimizar teclado">
        <div className={styles.handle} />
        <span className={styles.headerTitle}>
          {layoutType === 'tel' ? 'Teclado Numérico' : 'Teclado Alfanumérico'}
        </span>
        <div className={styles.headerActions}>
          <button type="button" className={styles.minimizeHeaderBtn} onClick={() => setInternalMinimized(true)}>
            🗕 Minimizar
          </button>
          <button type="button" className={styles.closeHeaderBtn} onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}>
            ✕ Ocultar
          </button>
        </div>
      </div>

      <div className={styles.keysContainer}>
        {currentLayout.map((row, rowIndex) => (
          <div key={rowIndex} className={styles.row}>
            {row.map((key) => {
              let label = key
              let keyClass = styles.key

              if (key === 'SHIFT') {
                label = '⇧'
                if (isShift) keyClass += ` ${styles.active}`
                keyClass += ` ${styles.specialKey}`
              } else if (key === 'ALT') {
                label = isAlt ? 'abc' : '?123'
                keyClass += ` ${styles.specialKey}`
              } else if (key === 'BACKSPACE') {
                label = '⌫'
                keyClass += ` ${styles.specialKey} ${styles.backspace}`
              } else if (key === 'SPACE') {
                label = 'Espacio'
                keyClass += ` ${styles.space}`
              } else if (key === 'ENTER') {
                label = '✓ Listo'
                keyClass += ` ${styles.enter}`
              }

              // Capitalize simple character labels if shift is active and not alt
              if (key.length === 1 && layoutType === 'text' && !isAlt) {
                label = isShift ? key.toUpperCase() : key.toLowerCase()
              }

              return (
                <button
                  key={key}
                  type="button"
                  className={keyClass}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleKeyClick(key)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
