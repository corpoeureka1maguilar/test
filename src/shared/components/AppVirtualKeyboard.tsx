import { useState, useEffect, useRef } from 'react'

const WRAPPER_CLASS =
  'group fixed bottom-0 left-0 right-0 bg-[rgba(255,255,255,0.85)] backdrop-blur-[25px] border-t border-surface-border shadow-[0_-20px_40px_rgba(0,0,0,0.08)] pt-2 px-4 pb-6 flex flex-col items-center z-[10000] animate-slideUp select-none ' +
  'data-[layout=tel]:max-w-[400px] data-[layout=tel]:mx-auto data-[layout=tel]:rounded-[24px_24px_0_0] data-[layout=tel]:border data-[layout=tel]:border-surface-border data-[layout=tel]:px-5 data-[layout=tel]:pt-2 data-[layout=tel]:pb-6 ' +
  '[@media(max-height:600px)]:pb-3'

const HEADER_BAR_CLASS =
  'group/header w-full max-w-[900px] flex items-center justify-between pt-2 px-1 pb-3 cursor-pointer relative [@media(max-height:600px)]:pb-[0.4rem]'

const KEY_BASE_CLASS =
  'flex-1 h-[clamp(44px,7vh,100px)] min-w-0 rounded-xl border border-[rgba(0,0,0,0.185)] bg-white text-text text-[3rem] font-normal cursor-pointer flex items-center justify-center transition-[transform,background-color,box-shadow] duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] shadow-[0_4px_8px_rgba(0,0,0,0.02)] active:scale-[0.96] active:bg-surface active:shadow-none group-data-[layout=tel]:h-[clamp(50px,8vh,64px)] [@media(max-height:600px)]:h-[38px] [@media(max-height:600px)]:rounded-lg'

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
          activeEl.closest('[data-virtual-keyboard]') ||
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
  }

  return (
    <div className={WRAPPER_CLASS} data-layout={layoutType} data-virtual-keyboard>
      {/* Sleek top header handle bar for quick minimizing */}
      <div className={HEADER_BAR_CLASS} onClick={() => setInternalMinimized(true)} role="button" aria-label="Minimizar teclado">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-11 h-[5px] bg-surface-heavy rounded-[10px] opacity-60 transition-opacity duration-300 group-hover/header:opacity-100" />
        <span className="text-[0.95rem] font-bold text-text-muted uppercase tracking-[0.05em]">
          {layoutType === 'tel' ? 'Teclado Numérico' : 'Teclado Alfanumérico'}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" className="bg-transparent text-text-muted border border-transparent rounded-[20px] px-[0.85rem] py-[0.35rem] text-[0.9rem] font-semibold cursor-pointer transition-all duration-200 hover:bg-[rgba(0,0,0,0.05)] hover:text-text active:scale-[0.96]" onClick={() => setInternalMinimized(true)}>
            🗕 Minimizar
          </button>
          <button type="button" className="bg-surface text-text border border-surface-border rounded-[20px] px-[0.85rem] py-[0.35rem] text-[0.9rem] font-bold cursor-pointer transition-all duration-200 active:scale-[0.96] active:bg-surface-hover" onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}>
            ✕ Ocultar
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-[0.6rem] w-full max-w-[900px]">
        {currentLayout.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-2 w-full justify-center">
            {row.map((key) => {
              let label = key
              let keyClass = KEY_BASE_CLASS

              if (key === 'SHIFT') {
                label = '⇧'
                if (isShift) keyClass += ' !bg-text !text-white'
                keyClass += ' bg-surface text-text-muted flex-[1.3] text-[clamp(0.9rem,1.5vw,1.1rem)]'
              } else if (key === 'ALT') {
                label = isAlt ? 'abc' : '?123'
                keyClass += ' bg-surface text-text-muted flex-[1.3] text-[clamp(0.9rem,1.5vw,1.1rem)]'
              } else if (key === 'BACKSPACE') {
                label = '⌫'
                // .backspace pisa el font-size de .specialKey en el CSS original (orden de la hoja)
                keyClass += ' bg-surface text-text-muted flex-[1.3] text-[2rem]'
              } else if (key === 'SPACE') {
                label = 'Espacio'
                keyClass += ' flex-[4] text-[clamp(0.9rem,1.5vw,1.05rem)] text-text-muted'
              } else if (key === 'ENTER') {
                label = '✓ Listo'
                keyClass += ' bg-accent text-white border-transparent flex-[2] text-[clamp(0.9rem,1.5vw,1.05rem)] shadow-[0_4px_12px_var(--color-accent-glow)] active:bg-accent-hover'
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
                  /* Enganche estable para que un contenedor pueda reestilar las
                     teclas (ver GiftCardPaymentView). Antes se dependía del
                     nombre de clase que generaba CSS Modules. */
                  data-key
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
