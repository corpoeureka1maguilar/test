# Design: Country-Aware Phone Field + Keyboard Desync Fix

## Technical Approach

Isolate all per-country phone logic in one seam: a `usePhoneInput(isVenezuelan)`
hook plus two dumb presentational components, selected by a single ternary in
`CustomerRegister.tsx`. The desync bug is fixed in the same migration by making
the phone field a **controlled** input driven by React state (the hook) via a
new dumb `PhoneKeyboard`, detaching it from the global `AppVirtualKeyboard`
singleton. `isVenezuelan` is derived from the existing signal `vat.startsWith('V-')`
— no new form field.

## Architecture Decisions

### D1 — Decoupling seam: hook + two dumb components (confirm proposal Option B)

**Choice**: `usePhoneInput(isVenezuelan)` owns value/format/validate/prefixes;
`VenezuelanPhoneField` and `InternationalPhoneField` are dumb. Page picks with
`{isVenezuelan ? <VenezuelanPhoneField .../> : <InternationalPhoneField .../>}`.
**Alternatives**: strategy-map (no precedent, over-engineered); single field with
`renderExtra` (harder to unit-test).
**Rationale**: matches hooks-per-concern convention (`useRegisterForm`,
`useAddressAutocomplete`); country branching collapses to one readable line.

### D2 — Controlled keyboard, NOT the global singleton (the bug fix)

**Choice**: phone display is a `readOnly` input (the global singleton explicitly
skips `readOnly` inputs — `AppVirtualKeyboard.tsx:45`), driven by a new dumb
`PhoneKeyboard` (controlled, follows `AppNumericKeyboard`'s value/onChange/
onConfirm pattern, zero DOM writes). All mutations — prefix quick-select AND
keypress — flow through the hook's `form.phone`.
**Alternatives**: reuse `AppNumericKeyboard` as-is (its internal `value+key`
mutation cannot do per-country live formatting and lacks a `+` key); keep the
global singleton (root cause of the desync).
**Rationale**: single React source of truth eliminates the stale-cache clobber.
`readOnly` display means no focusable input, so the singleton never engages for
phone while still serving name/estado/street.

### D3 — International format/validation (concrete, E.164-ish)

**Choice**: add `isValidInternationalPhone` (`/^\+\d{7,15}$/` after stripping
spaces) and `formatInternationalPhone` (single leading `+`, strip non-digits,
cap 15) to `paymentUtils.ts`. VE functions untouched.
**Rationale**: E.164 max is 15 digits; 7-digit floor matches the existing (mis-
placed) `+` branch already covered by `paymentUtils.test.ts`. No display grouping
to avoid ambiguous country-code splits.

### D4 — Do NOT delete the `isLocalInstance` branch (re-verification correction)

**Choice**: keep `AppVirtualKeyboard.isLocalInstance`; only remove the dead
`<AppVirtualKeyboard value=.../>` JSX from `CustomerRegister.tsx`.
**Evidence (contradicts proposal's "zero other consumers")**: grep shows
`ProductCatalog.tsx:609` AND `pageCatalogBk.tsx:525` also pass `value`, so they
too rely on the null-return branch. Deleting it would activate real local
keyboards there alongside the global singleton → double-keyboard regression.
**Rationale**: the branch is load-bearing; scope the cleanup to CustomerRegister.

### D5 — Composition with `useRegisterForm` (no duplication, no broken call sites)

**Choice**: `form.phone` stays the single source of truth (formatted string,
unchanged persisted format). `useRegisterForm` derives `isVenezuelan` from `vat`,
delegates phone to `usePhoneInput`, and drops `handlePrefixSelect` /
`handleKeyboardChange` phone coupling. Convert the static schema to
`makeRegisterSchema(isVenezuelan)` whose phone refine picks the VE or
international validator; keep `registerSchema = makeRegisterSchema(true)` for
back-compat. `validate()` return shape (zod result) is unchanged.
**Call-site safety**: `useRegisterForm` is used only in `CustomerRegister.tsx`;
`formatPhone` only in `useRegisterForm`+tests; `isValidVenezuelanPhone` also in
`PaymentForm.tsx:106` (pago_movil) — left untouched, no regression.

## Data Flow (corrected keyboard → state)

    User taps 0424      User taps key '1'
         │                    │
         ▼                    ▼
    VenezuelanPhoneField   PhoneKeyboard (dumb, controlled)
         │ onPrefixSelect      │ onKeyPress('1')
         ▼                     ▼
    usePhoneInput ── strip+append+formatPhone ──► setForm(form.phone)
         ▲                                             │
         └──────────── value (formatted) ─────────────┘
                              │
                              ▼
                readOnly <input> display  (global singleton skips it)

Single path in, single path out — no native `input` event, no stale
`localValue` cache, so the prefix the user picked cannot be clobbered.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `hooks/usePhoneInput.ts` | Create | Per-country value/format/validate/prefixes/keypress |
| `components/VenezuelanPhoneField.tsx` | Create | VE carrier quick-select + display + keyboard |
| `components/InternationalPhoneField.tsx` | Create | `+` entry + display + keyboard |
| `components/PhoneKeyboard.tsx` | Create | Dumb controlled numeric(+`+`) keyboard |
| `hooks/useRegisterForm.ts` | Modify | Delegate phone to hook; `makeRegisterSchema`; drop phone/keyboard coupling |
| `pages/CustomerRegister.tsx` | Modify | Render selected field; remove dead `AppVirtualKeyboard` JSX + prefix buttons |
| `shared/lib/paymentUtils.ts` | Modify | Add international validate/format; VE untouched |
| `hooks/usePhoneInput.test.ts` | Create | Round-trip + validation tests |
| `hooks/useRegisterForm.test.ts` | Modify | Country-aware schema cases |
| `shared/lib/paymentUtils.test.ts` | Modify | International validate/format cases |

## Interfaces

```ts
function usePhoneInput(isVenezuelan: boolean): {
  value: string            // form.phone, formatted
  onKeyPress: (k: string) => void
  onBackspace: () => void
  onPrefixSelect: (p: string) => void   // VE carriers | '+'
  isValid: boolean
  prefixes: string[]
}
function isValidInternationalPhone(v: string): boolean
function formatInternationalPhone(v: string): string
function makeRegisterSchema(isVenezuelan: boolean): ZodSchema
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `usePhoneInput` round-trip: prefix then keypress must not corrupt | `renderHook`, no DOM/singleton |
| Unit | international validate/format edges (`+`, 7/15 bounds) | pure fn asserts |
| Unit | `makeRegisterSchema(true/false)` phone acceptance | zod safeParse |
| Integration | field renders correct variant per `isVenezuelan` | RTL render |

## Migration / Rollout

No data migration; additive hook/components. Persisted phone format unchanged.
`AppVirtualKeyboard` singleton untouched for other fields. Rollback = `git revert`.

## Open Questions

- [ ] `isValidVenezuelanPhone` still accepts `+` numbers (pre-existing quirk in
  `PaymentForm` pago_movil) — leave as-is (out of scope) or tighten later?
