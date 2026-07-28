import type { ChangeEvent, FocusEvent } from 'react'
import { useState, useRef, useEffect } from 'react'

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
      <div ref={dropdownRef} className="relative flex flex-col">
        <div
          className={
            'flex items-center w-full h-[var(--kiosk-input-height)] bg-surface border-2 border-transparent rounded-[22px] overflow-hidden transition-[transform,border-color,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]' +
            ((isActive || isFocused) ? ' bg-white border-accent shadow-[0_10px_30px_-10px_var(--color-accent-glow)] -translate-y-0.5' : '')
          }
        >

          {/* Custom prefix dropdown trigger */}
          <div className="shrink-0">
            <button
              type="button"
              aria-label={activePrefix}
              className="flex items-center gap-[0.4rem] h-[var(--kiosk-input-height)] pl-6 pr-5 py-0 bg-transparent border-0 text-[length:var(--kiosk-input-font-size)] font-app font-bold text-text cursor-pointer outline-none transition-opacity duration-150 ease-linear whitespace-nowrap active:opacity-[0.65]"
              onMouseDown={(e) => {
                e.preventDefault()
                setIsDropdownOpen(o => !o)
              }}
            >
              {activePrefix}
              <svg
                className={`w-4 h-4 stroke-text-muted transition-transform duration-200 ease shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          <div className="w-px h-[40%] bg-surface-border self-center mx-2" />

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
            className="flex-1 w-full! h-full! bg-transparent! border-0! rounded-none! shadow-none! transform-none! pr-6 pl-5 py-0 text-[length:var(--kiosk-input-font-size)] outline-none tracking-[0.05em]"
          />
        </div>

        {isDropdownOpen && (
          <div className="absolute top-[calc(100%+8px)] left-0 z-[9999] min-w-[140px] bg-white border-[1.5px] border-surface-border rounded-2xl shadow-[0_12px_40px_-8px_rgba(0,0,0,0.18),0_4px_16px_-4px_rgba(0,0,0,0.08)] overflow-hidden p-[0.4rem] flex flex-col gap-[0.2rem]">
            {prefixes.map((prefix) => (
              <button
                key={prefix}
                type="button"
                className={
                  'block w-full px-[1.1rem] py-[0.65rem] bg-transparent border-0 rounded-[10px] text-[1.3rem] font-app font-semibold text-left cursor-pointer transition-colors duration-[120ms] ease' +
                  (prefix === activePrefix
                    ? ' bg-accent-subtle text-accent hover:bg-accent-subtle'
                    : ' text-text hover:bg-surface')
                }
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
                className="block w-full px-[1.1rem] py-[0.65rem] bg-transparent border-0 rounded-[10px] text-[1.3rem] font-app font-semibold text-text text-left cursor-pointer transition-colors duration-[120ms] ease hover:bg-surface"
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
