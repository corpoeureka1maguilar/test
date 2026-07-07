import type { ChangeEvent, FocusEvent } from 'react'
import styles from '../pages/CustomerRegister.module.css'

interface VenezuelanPhoneFieldProps {
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onPrefixSelect: (prefix: string) => void
  prefixes: string[]
  isActive: boolean
  onFocus: () => void
  onBlur: (e: FocusEvent<HTMLInputElement>) => void
}

/**
 * Dumb, presentational Venezuelan phone field: a plain controlled `tel` input
 * (integrates with the global `AppVirtualKeyboard` singleton, which already
 * defaults to its numeric layout for `type="tel"`) plus carrier quick-select
 * buttons. All country logic lives in `usePhoneInput`.
 */
export function VenezuelanPhoneField({
  value,
  onChange,
  onPrefixSelect,
  prefixes,
  isActive,
  onFocus,
  onBlur
}: VenezuelanPhoneFieldProps) {
  return (
    <label>Teléfono
      <input
        type="tel"
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        inputMode="none"
        placeholder="04XX-XXXXXXX"
      />
      {isActive && (
        <div className={styles.prefixContainer}>
          {prefixes.map((prefix) => (
            <button
              key={prefix}
              type="button"
              className={styles.prefixButton}
              onMouseDown={(e) => {
                e.preventDefault()
                onPrefixSelect(prefix)
              }}
            >
              {prefix}
            </button>
          ))}
        </div>
      )}
    </label>
  )
}
