# Tasks: Country-Aware Phone Field + Keyboard Desync Fix

Strict TDD is active for this project. Test-writing tasks are ordered
before/alongside the implementation task they cover, not after.

## 1. Infra / Seam Foundations

### 1.1 `paymentUtils.ts` — international phone helpers (sequential, blocks 1.2)
- [x] 1.1.1 Write failing tests in `src/shared/lib/paymentUtils.test.ts` for
  `isValidInternationalPhone` (`/^\+\d{7,15}$/` after stripping spaces: valid
  7/15-digit `+` numbers, reject <7 or >15 digits, reject missing `+`) and
  `formatInternationalPhone` (single leading `+`, strips non-digits, caps at
  15 digits).
  - Satisfies: spec §"Non-Venezuelan customer sees international entry"
    (real validation, not passthrough).
- [x] 1.1.2 Implement `isValidInternationalPhone` and `formatInternationalPhone`
  in `src/shared/lib/paymentUtils.ts`. Do NOT modify `isValidVenezuelanPhone`
  or `formatPhone` (both are consumed by `PaymentForm.tsx:106` for
  `pago_movil`).
  - Satisfies: design D3; spec §"Non-Venezuelan customer sees international
    entry".

### 1.2 `usePhoneInput(isVenezuelan)` hook (sequential, depends on 1.1, blocks 2.x)
- [x] 1.2.1 Write failing tests in
  `src/features/customer/hooks/usePhoneInput.test.ts` using `renderHook`
  (no DOM/singleton) covering:
  - VE mode: prefix select (`0412`/`0414`/`0424`/`0416`/`0426`/`0422`) sets
    `value`; subsequent `onKeyPress` appends to (does not replace/corrupt)
    the prefix already shown — **the core bug-fix regression proof**.
  - VE mode: `onBackspace` removes only from current displayed value, never
    resurrects stale digits.
  - International mode: `onPrefixSelect('+')` seeds `+`; `onKeyPress` appends
    digits; `isValid` reflects `isValidInternationalPhone`.
  - `isValid` reflects `isValidVenezuelanPhone` in VE mode.
  - `prefixes` returns the VE carrier list in VE mode, `['+']` (or
    equivalent single international prefix) in international mode.
  - Satisfies: spec §"Virtual Keyboard Value Integrity for Phone Field" (all
    three scenarios), §"Isolated Per-Country Phone Logic Seam".
- [x] 1.2.2 Implement `src/features/customer/hooks/usePhoneInput.ts` per the
  design interface:
  ```ts
  function usePhoneInput(isVenezuelan: boolean): {
    value: string
    onKeyPress: (k: string) => void
    onBackspace: () => void
    onPrefixSelect: (p: string) => void
    isValid: boolean
    prefixes: string[]
  }
  ```
  Single internal `useState` source of truth; VE branch uses
  `formatPhone`/`isValidVenezuelanPhone`; international branch uses
  `formatInternationalPhone`/`isValidInternationalPhone` from 1.1.2. No DOM
  writes, no native events.
  - Satisfies: design D1, D2, D5; spec §"Isolated Per-Country Phone Logic
    Seam", §"Virtual Keyboard Value Integrity for Phone Field".

## 2. Implementation — Components

### 2.1 `PhoneKeyboard` component (sequential, depends on 1.2, blocks 2.2/2.3)
- [x] 2.1.1 Create `src/features/customer/components/PhoneKeyboard.tsx`: dumb,
  controlled numeric keyboard following `AppNumericKeyboard`'s
  `value`/`onChange`/`onConfirm` pattern, extended with a `+` key for
  international mode (prop-gated or always present — implementer's call
  within the dumb-component constraint). Zero DOM writes; all mutation via
  props/callbacks (`onKeyPress`, `onBackspace`).
  - Satisfies: design D2; spec §"Virtual Keyboard Value Integrity for Phone
    Field".
- [x] 2.1.2 Add companion CSS module `PhoneKeyboard.module.css` if the
  existing `AppNumericKeyboard.module.css` classes are not directly reusable
  (check before duplicating styles). — Checked: `AppNumericKeyboard.module.css`
  classes are directly reusable (imported as-is), no new CSS file created.

### 2.2 `VenezuelanPhoneField` component (parallel with 2.3, depends on 2.1)
- [x] 2.2.1 Create `src/features/customer/components/VenezuelanPhoneField.tsx`:
  dumb component taking `usePhoneInput` return values as props; renders VE
  carrier quick-select buttons + `readOnly` display input (per
  `CustomerIdentity.tsx` readOnly-display pattern) + `PhoneKeyboard`.
  - Satisfies: spec §"Venezuelan customer sees carrier quick-select".

### 2.3 `InternationalPhoneField` component (parallel with 2.2, depends on 2.1)
- [x] 2.3.1 Create `src/features/customer/components/InternationalPhoneField.tsx`:
  dumb component, same shape as 2.2.1 but for `+<country-code>` entry (no VE
  carrier buttons; `+` prefix seed only).
  - Satisfies: spec §"Non-Venezuelan customer sees international entry".

## 3. Implementation — Form/Schema Integration

### 3.1 Test-first: country-aware schema (sequential, before 3.2)
- [x] 3.1.1 Update `src/features/customer/hooks/useRegisterForm.test.ts`:
  add cases for `makeRegisterSchema(true)` (VE — existing cases still pass)
  and `makeRegisterSchema(false)` (international — accepts valid `+` numbers
  per `isValidInternationalPhone`, rejects VE-only formats without `+` if
  they don't also satisfy international rules, rejects out-of-range digit
  counts). Keep existing `registerSchema` import working via back-compat
  export.
  - Satisfies: spec §"Country-Aware Phone Field Selection"; design D5.

### 3.2 `makeRegisterSchema(isVenezuelan)` (sequential, depends on 3.1 + 1.1.2)
- [x] 3.2.1 Refactor `src/features/customer/hooks/useRegisterForm.ts`:
  convert the static `registerSchema` into
  `makeRegisterSchema(isVenezuelan: boolean)` whose phone `.refine()` picks
  `isValidVenezuelanPhone` or `isValidInternationalPhone`. Keep
  `export const registerSchema = makeRegisterSchema(true)` for back-compat.
  `validate()` return shape (zod `safeParse` result) is unchanged.
  - Satisfies: design D5.
- [x] 3.2.2 In the same file, derive `isVenezuelan` from
  `vat.startsWith('V-')`, delegate phone value/format/validate/prefix to
  `usePhoneInput(isVenezuelan)` (from 1.2.2), and remove
  `handlePrefixSelect`/`handleKeyboardChange`'s phone-specific branches (keep
  them for non-phone fields — name/estado/street/email still use the
  existing `set`/`handleKeyboardChange` path). Expose whatever the hook
  returns (`phoneInput` or spread) through the existing hook's return object
  so `CustomerRegister.tsx` can consume it.
  - Satisfies: design D5; spec §"Country-Aware Phone Field Selection"
    (nationality-signal switch scenario — re-render without carrying over
    prior mode's formatting, guaranteed by `usePhoneInput` re-mounting/reset
    on `isVenezuelan` change).

### 3.3 `CustomerRegister.tsx` — single ternary + dead-code removal (sequential, depends on 2.2, 2.3, 3.2)
- [x] 3.3.1 Replace the inline `<label>Teléfono...` block (lines ~166-207)
  with the single mode-selection ternary:
  `{isVenezuelan ? <VenezuelanPhoneField .../> : <InternationalPhoneField .../>}`
  — no country-specific formatting/validation logic inline in this file.
  - Satisfies: spec §"Isolated Per-Country Phone Logic Seam" (page performs
    at most one conditional).
- [x] 3.3.2 Remove ONLY the dead duplicate `<AppVirtualKeyboard value=... />`
  JSX block that renders for `activeField === 'phone'` (lines ~299-309 render
  unconditionally on `activeField`; scope the removal to the phone-specific
  usage now that phone is controlled by `PhoneKeyboard`). Keep
  `AppVirtualKeyboard` rendering for `name`/`estado`/`street`/`email`. Do NOT
  touch `AppVirtualKeyboard.tsx`'s `isLocalInstance`/null-return branch — it
  is load-bearing for `ProductCatalog.tsx:609` and `pageCatalogBk.tsx:525`.
  - Satisfies: design D4; proposal "Affected Modules" (`CustomerRegister.tsx`
    cleanup scope).
- [x] 3.3.3 Remove the now-unused `console.log('DEBUG CustomerRegister...')`
  line only if it is a leftover from this feature's debugging — otherwise
  leave untouched (out of scope unless directly related to the phone field
  change).

## 4. Testing — Integration / Regression Proof

### 4.1 Regression test: prefix-select then keypress does not corrupt value (parallel with 4.2, depends on 1.2.1/1.2.2 and 3.2)
- [x] 4.1.1 Confirm `usePhoneInput.test.ts` (from 1.2.1) explicitly asserts
  the "0426 stacked over 0424"-style bug is fixed: tap prefix `0424` → type
  `1` → assert value is `formatPhone('04241')`-equivalent, NOT a
  duplicated/reset value. This is the change's core acceptance proof and
  MUST be green before this change is considered done.
  - Satisfies: spec §"Typing after quick-select prefix preserves the value".

### 4.2 Integration test: correct field variant per nationality (parallel with 4.1)
- [x] 4.2.1 Add/extend an RTL render test (in `useRegisterForm.test.ts` or a
  new `CustomerRegister`-adjacent test if one exists) asserting
  `VenezuelanPhoneField` renders when `vat` starts with `V-` and
  `InternationalPhoneField` renders otherwise, and that switching the `vat`
  signal before submit does not carry over the previous mode's formatted
  value (per spec's "Switching nationality signal" scenario).
  - Satisfies: spec §"Switching nationality signal updates the field".

### 4.3 Full regression pass (sequential, depends on all above)
- [x] 4.3.1 Run `npm test` (all phone-related suites) and `npm run typecheck`.
  No merge until both pass — per proposal's Rollback Plan verification gate.

---

## Review Workload Forecast

Estimated changed/added lines (new files counted in full; modified files
counted as diff delta):

| File | Type | Est. Lines |
|------|------|-----------|
| `shared/lib/paymentUtils.ts` (+2 fns) | Modify | +25 |
| `shared/lib/paymentUtils.test.ts` (+intl cases) | Modify | +35 |
| `hooks/usePhoneInput.ts` | Create | +70 |
| `hooks/usePhoneInput.test.ts` | Create | +90 |
| `components/PhoneKeyboard.tsx` (+css) | Create | +60 |
| `components/VenezuelanPhoneField.tsx` | Create | +55 |
| `components/InternationalPhoneField.tsx` | Create | +45 |
| `hooks/useRegisterForm.ts` (schema→factory + delegate) | Modify | +30 / -15 |
| `hooks/useRegisterForm.test.ts` (+country cases +integration) | Modify | +45 |
| `pages/CustomerRegister.tsx` (ternary + dead-code removal) | Modify | +10 / -45 |
| **Total (additions, rough)** | | **~465** |

- **400-line budget risk: High.** Rough addition estimate (~465 lines,
  excluding deletions) exceeds the 400-line single-PR review budget even
  before accounting for review friction across 4 new files + 3 modified
  files spanning hooks, components, and a shared util.
- **Chained PRs recommended: Yes.** Suggested split:
  1. PR1 (infra): Section 1 — `paymentUtils.ts` international helpers +
     `usePhoneInput` hook + their tests (~220 lines). Independently
     reviewable/testable, no UI risk.
  2. PR2 (components): Section 2 — `PhoneKeyboard`, `VenezuelanPhoneField`,
     `InternationalPhoneField` (~160 lines). Depends on PR1 merging first.
  3. PR3 (integration + bug-fix proof): Section 3 + Section 4 —
     `useRegisterForm.ts` schema factory, `CustomerRegister.tsx` wiring +
     dead-code removal, regression/integration tests (~85 lines net, but
     highest *risk* concentration — this is where the desync bug fix is
     proven or not). Depends on PR1 + PR2.
- **Decision needed before apply: Yes.** Orchestrator/user must confirm
  chained-PR (or stacked-branch) strategy before `sdd-apply` starts batching
  work, per the Review Workload Guard.

## Task Dependency Summary

- Sequential chain: 1.1 → 1.2 → (2.1 → {2.2 ∥ 2.3}) → 3.1 → 3.2 → 3.3 → {4.1 ∥ 4.2} → 4.3
- Parallelizable pairs: {2.2, 2.3} after 2.1; {4.1, 4.2} after 3.3
- Highest bottleneck: 1.2 (`usePhoneInput`) — nearly all downstream work
  depends on its interface being stable; changing its shape late requires
  re-touching both field components and `useRegisterForm.ts`.
