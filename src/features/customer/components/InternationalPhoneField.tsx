import type { ChangeEvent, FocusEvent } from 'react'

interface InternationalPhoneFieldProps {
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onFocus: () => void
  onBlur: (e: FocusEvent<HTMLInputElement>) => void
}

/**
 * Dumb, presentational international phone field: a plain controlled `tel`
 * input. `usePhoneInput` auto-prepends `+` via `formatInternationalPhone`, so
 * no seed button is needed — the user just types digits. No carrier
 * quick-select buttons; country logic lives entirely in `usePhoneInput`.
 */
export function InternationalPhoneField({ value, onChange, onFocus, onBlur }: InternationalPhoneFieldProps) {
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
    </label>
  )
}
