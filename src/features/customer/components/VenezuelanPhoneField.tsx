import type { ChangeEvent, FocusEvent } from 'react'
import { useState, useRef, useEffect } from 'react'
import styles from '../pages/CustomerRegister.module.css'

interface VenezuelanPhoneFieldProps {
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onPrefixSelect: (prefix: string) => void
  prefixes: string[]
  isActive: boolean
  onFocus: () => void
  onBlur: (e: FocusEvent<HTMLInputElement>) => void
  /** Present when the customer's document allows opting into an international number instead of a local carrier one. */
  onSwitchToInternational?: () => void
}

/**
 * Dumb, presentational Venezuelan phone field: features a custom-styled
 * prefix dropdown at the beginning of the input container followed by the
 * text input. Uses a custom div-based dropdown so the open panel is fully
 * styleable (native <select> dropdown cannot be styled cross-browser).
 */
export function VenezuelanPhoneField({
  value,
  onChange,
  onPrefixSelect,
  prefixes,
  isActive,
  onFocus,
  onBlur,
  onSwitchToInternational
}: VenezuelanPhoneFieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activePrefix = prefixes.find(p => value.startsWith(p)) || prefixes[0] || ''
  const restValue = activePrefix ? value.slice(activePrefix.length).replace(/^-/, '') : value

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const cleanRest = e.target.value.replace(/\D/g, '')
    const newFullRaw = activePrefix + cleanRest
    onChange({ ...e, target: { ...e.target, value: newFullRaw } } as ChangeEvent<HTMLInputElement>)
  }

  const handlePrefixSelect = (prefix: string) => {
    onPrefixSelect(prefix)
    setIsDropdownOpen(false)
  }

  const handleSwitchToInternational = () => {
    onSwitchToInternational?.()
    setIsDropdownOpen(false)
  }

  return (
    <label>Teléfono
      <div ref={dropdownRef} className={styles.phoneFieldWrapper}>
        <div className={`${styles.phoneInputContainer} ${(isActive || isFocused) ? styles.phoneInputContainerFocus : ''}`}>

          {/* Custom prefix dropdown trigger */}
          <div className={styles.prefixDropdown}>
            <button
              type="button"
              aria-label={activePrefix}
              className={styles.prefixTrigger}
              onMouseDown={(e) => {
                e.preventDefault()
                setIsDropdownOpen(o => !o)
              }}
            >
              {activePrefix}
              <svg
                className={`${styles.prefixChevron} ${isDropdownOpen ? styles.prefixChevronOpen : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          <div className={styles.prefixSeparator} />

          <input
            type="tel"
            value={restValue}
            onChange={handleInputChange}
            onFocus={() => {
              setIsFocused(true)
              setIsDropdownOpen(false)
              onFocus()
            }}
            onBlur={(e) => {
              setIsFocused(false)
              onBlur(e)
            }}
            inputMode="none"
            placeholder="XXXXXXX"
            className={styles.phoneInput}
          />
        </div>

        {isDropdownOpen && (
          <div className={styles.prefixMenu}>
            {prefixes.map((prefix) => (
              <button
                key={prefix}
                type="button"
                className={`${styles.prefixMenuItem} ${prefix === activePrefix ? styles.prefixMenuItemActive : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handlePrefixSelect(prefix)
                }}
              >
                {prefix}
              </button>
            ))}
            {onSwitchToInternational && (
              <button
                type="button"
                className={styles.prefixMenuItem}
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSwitchToInternational()
                }}
              >
                Otro país
              </button>
            )}
          </div>
        )}
      </div>
    </label>
  )
}
