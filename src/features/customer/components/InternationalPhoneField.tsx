import type { ChangeEvent, FocusEvent } from 'react'
import styles from '../pages/CustomerRegister.module.css'

interface InternationalPhoneFieldProps {
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onFocus: () => void
  onBlur: (e: FocusEvent<HTMLInputElement>) => void
  /** Present when the customer got here by opting out of the Venezuelan carrier field, so they can undo it. */
  onBackToVenezuelan?: () => void
}

/**
 * Dumb, presentational international phone field: a plain controlled `tel`
 * input. `usePhoneInput` auto-prepends `+` via `formatInternationalPhone`, so
 * no seed button is needed — the user just types digits. No carrier
 * quick-select buttons; country logic lives entirely in `usePhoneInput`.
 */
export function InternationalPhoneField({ value, onChange, onFocus, onBlur, onBackToVenezuelan }: InternationalPhoneFieldProps) {
  return (
    <label>Teléfono
      <input
        type="tel"
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        inputMode="none"
        placeholder="+<código país><número>"
      />
      {onBackToVenezuelan && (
        <button
          type="button"
          className={styles.phoneModeSwitch}
          onMouseDown={(e) => { e.preventDefault(); onBackToVenezuelan() }}
        >
          Es un número venezolano
        </button>
      )}
    </label>
  )
}
