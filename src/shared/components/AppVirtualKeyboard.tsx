import { useState } from 'react'
import styles from './AppVirtualKeyboard.module.css'

interface AppVirtualKeyboardProps {
  value: string
  onChange: (value: string) => void
  onClose?: () => void
  onEnter?: () => void
  layoutType?: 'text' | 'tel'
}

export function AppVirtualKeyboard({
  value,
  onChange,
  onClose,
  onEnter,
  layoutType = 'text'
}: AppVirtualKeyboardProps) {
  const [isShift, setIsShift] = useState(true) // Start capitalized for premium feel
  const [isAlt, setIsAlt] = useState(false)

  const handleKeyClick = (key: string) => {
    if (key === 'SHIFT') {
      setIsShift(s => !s)
      return
    }
    if (key === 'ALT') {
      setIsAlt(a => !a)
      return
    }
    if (key === 'BACKSPACE') {
      onChange(value.slice(0, -1))
      return
    }
    if (key === 'SPACE') {
      onChange(value + ' ')
      return
    }
    if (key === 'ENTER') {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      if (onEnter) onEnter()
      if (onClose) onClose()
      return
    }
    if (key === 'CLOSE') {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      if (onClose) onClose()
      return
    }

    // Normal characters
    let char = key
    if (layoutType === 'text' && !isAlt) {
      char = isShift ? key.toUpperCase() : key.toLowerCase()
    }
    onChange(value + char)
  }

  // Keyboard layout configurations
  const textLayoutNormal = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'],
    ['SHIFT', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'BACKSPACE'],
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

  const handleHide = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    if (onClose) onClose()
  }

  return (
    <div className={styles.wrapper} data-layout={layoutType}>
      {/* Sleek top header handle bar for quick minimizing */}
      <div className={styles.headerBar} onClick={handleHide} title="Ocultar teclado">
        <div className={styles.handle} />
        <span className={styles.headerTitle}>
          {layoutType === 'tel' ? 'Teclado Numérico' : 'Teclado Alfanumérico'}
        </span>
        <button type="button" className={styles.closeHeaderBtn} onClick={(e) => { e.stopPropagation(); handleHide(); }}>
          ✕ Ocultar
        </button>
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
