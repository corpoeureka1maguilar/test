import type { ChangeEvent, FocusEvent } from 'react'

interface InternationalPhoneFieldProps {
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onFocus: () => void
  onBlur: (e: FocusEvent<HTMLInputElement>) => void
  /** Present when the customer got here by opting out of the Venezuelan carrier field, so they can undo it. */
  onBackToVenezuelan?: (() => void) | undefined
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
          className="self-start mt-2 p-0 bg-transparent border-0 text-[0.9rem] font-semibold normal-case tracking-normal text-accent cursor-pointer"
          onMouseDown={(e) => { e.preventDefault(); onBackToVenezuelan() }}
        >
          Es un número venezolano
        </button>
      )}
    </label>
  )
}
