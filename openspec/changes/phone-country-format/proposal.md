# Proposal: Country-Aware Phone Field + Keyboard Desync Fix

## Intent

**Problem.** The customer-registration phone field is Venezuela-only and is
corrupted by an on-screen keyboard desync bug:

- Validation/formatting (`isValidVenezuelanPhone`, `formatPhone` in
  `src/shared/lib/paymentUtils.ts`) hardcode Venezuelan carrier prefixes. The
  international `+` path is a no-op passthrough — non-Venezuelan customers have
  no real phone format or validation.
- The phone field is driven by the **global `AppVirtualKeyboard` singleton**
  (mounted in `RootLayout.tsx`), which tracks the focused input via native DOM
  `input`/`focusin` events plus a private `localValue` cache — bypassing React
  state. The VE carrier quick-select buttons mutate `form.phone` through pure
  React state and fire **no** native `input` event, so the keyboard's cache goes
  stale. The next keypress recomputes `staleValue + char` and force-overwrites
  the DOM, clobbering the prefix the user just picked. This is the observed
  "0426 stacked over 0424" corruption — a two-sources-of-truth desync, not CSS.
- `CustomerRegister.tsx` also renders a **second** `AppVirtualKeyboard` instance
  that hits the dead `isLocalInstance` branch (returns `null`) — 100% no-op dead
  code that masks the real architecture.

**Why now.** Non-Venezuelan customers cannot register a valid phone, and even
Venezuelan customers hit the corruption bug when combining quick-select prefixes
with the on-screen keyboard. Both block reliable kiosk registration.

**Success looks like.**
1. Venezuelan customers keep the carrier quick-select prefix UX
   (`0412/0414/0424/0416/0426/0422`) exactly as today, with correct VE
   formatting and validation.
2. Non-Venezuelan customers get an international `+<country-code>` phone entry
   with its own format and validation.
3. All country-specific phone logic lives in one isolated seam (hook +
   per-country dumb components) — no country conditionals sprinkled across
   `CustomerRegister.tsx`.
4. Typing on the on-screen keyboard never resets or corrupts the phone number,
   including after using a quick-select prefix.

## Scope

### In scope
- A `usePhoneInput(isVenezuelan)` hook encapsulating per-country phone
  `value`/`onChange`/format/validate/prefix-list, keyed off the existing
  nationality signal `vat.startsWith('V-')` (no new form field).
- Two small presentational components: `VenezuelanPhoneField` (carrier
  quick-select + VE grouping) and `InternationalPhoneField` (`+` country-code
  entry). The page picks one; no per-country branches leak beyond that pick.
- Migrate the phone field OFF the global `AppVirtualKeyboard` singleton onto a
  **controlled** keyboard following the existing `AppNumericKeyboard.tsx`
  pattern (`value`/`onChange`/`onConfirm`, no DOM writes). This is what fixes
  the desync — a single React source of truth for the field value.
- Add international phone validation/formatting to `paymentUtils.ts` (replace
  the current `+` no-op passthrough with real logic), keeping VE logic intact.
- Remove the dead second `AppVirtualKeyboard` instance and the now-unused
  `isLocalInstance` prop usage from `CustomerRegister.tsx`.
- Unit tests: extend `useRegisterForm.test.ts` and add tests for
  `usePhoneInput` and the international validate/format helpers (strict TDD is
  enabled for this project).

### Out of scope
- A full country picker / dropdown of all countries. VE-vs-non-VE stays a
  **binary derived from the cédula/RIF prefix** chosen in `CustomerIdentity.tsx`
  (`V-` = Venezuelan). See Known Limitations.
- Removing/refactoring the global `AppVirtualKeyboard` singleton itself — it
  still serves the free-text alphanumeric fields (name/estado/street). We only
  detach the phone field from it. We may delete the dead `isLocalInstance`
  branch of the component if grep confirms zero other consumers, but that is a
  cleanup, not a redesign.
- Backend/Odoo changes. Phone is persisted as-is through the existing
  `useCreatePartner` path; no new RPC contract.
- Per-country phone masks beyond VE and a generic international format.

## Approach Decision

**Chosen: Option B — `usePhoneInput(isVenezuelan)` hook + two dumb components.**

Rejected alternatives (from exploration):
- **A) `phoneFormatStrategy` map keyed by nationality.** Clean single seam but
  introduces an OOP strategy-map pattern with no precedent in this
  hooks-per-concern codebase — over-engineering for a binary case.
- **C) Single `PhoneField` with pluggable `renderExtra`.** Highest cohesion,
  zero page conditionals, but more upfront abstraction than two variants
  justify and harder to unit-test than B.

**Rationale.** Option B matches the established convention (`useRegisterForm`,
`useAddressAutocomplete`, `useCreatePartner` are all hooks-per-concern) and is
testable in isolation like the existing `useRegisterForm.test.ts`. The only
concession is a single component-selection conditional at the page level
(`isVenezuelan ? <VenezuelanPhoneField/> : <InternationalPhoneField/>`), which
is the natural, readable seam — not scattered logic. This satisfies the
"desacoplado y alta cohesión" requirement: format/validate/prefix logic is
fully isolated per country inside the hook and its two components.

**Why this also fixes the bug (the fix is scoped INTO this change, not
separate).** The desync exists because the phone field piggybacks on the global
keyboard singleton's private cache. Option B's hook returns a controlled
`value`/`onChange`; wiring the phone field to a controlled `AppNumericKeyboard`-
style keyboard makes React the single source of truth. Quick-select prefixes and
keypresses then both flow through the same `onChange`, so no stale cache can
clobber the value. The country decoupling and the bug fix share the same
migration — doing them together avoids migrating the field twice.

## Affected Modules

- `src/features/customer/hooks/useRegisterForm.ts` — delegate phone
  value/format/validate/prefix to `usePhoneInput`; drop `handlePrefixSelect` /
  `handleKeyboardChange` coupling to the global keyboard.
- `src/features/customer/hooks/usePhoneInput.ts` — **new** hook (per-country
  logic).
- `src/features/customer/components/VenezuelanPhoneField.tsx`,
  `InternationalPhoneField.tsx` — **new** dumb components.
- `src/features/customer/pages/CustomerRegister.tsx` — render the selected
  phone field; remove dead `AppVirtualKeyboard` instance and prefix-button
  wiring.
- `src/shared/lib/paymentUtils.ts` — add international validate/format; keep VE
  functions.
- `src/shared/components/AppVirtualKeyboard.tsx` — optional cleanup of dead
  `isLocalInstance` branch (only if no other consumer).
- Tests: `useRegisterForm.test.ts` (update), `usePhoneInput.test.ts` (new),
  `paymentUtils` international cases (new).
- Spec: `openspec/specs/customer-registration/spec.md` — add country-aware phone
  requirements.

## Rollback Plan

Per `openspec/config.yaml` (proposal rules require a rollback plan for risky
changes):

- **Isolation.** All changes land on branch `feat/vercel-support`'s successor
  feature branch, behind no runtime feature flag but fully additive: new hook +
  new components. The global `AppVirtualKeyboard` singleton is untouched for
  every other field, so a revert cannot regress name/estado/street inputs.
- **Revert path.** Because the phone migration is contained to the customer
  feature folder plus additive `paymentUtils` functions, rollback is a single
  `git revert` of the change's commits. The VE-only behavior returns intact
  (the old `handlePrefixSelect` + global-keyboard path is restored by the
  revert).
- **Safety net.** Keep the original VE `formatPhone`/`isValidVenezuelanPhone`
  signatures and behavior unchanged (only add international branches), so any
  code still calling them elsewhere is unaffected if the UI change is reverted.
- **Verification gate.** Strict TDD: no merge until `npm test` passes for the
  new/updated phone tests plus `npm run typecheck`. If the desync fix cannot be
  proven by test (controlled value round-trip through prefix + keypress), the
  change does not ship.

## Known Limitations

- **VE / non-VE is a binary**, derived from the cédula/RIF prefix
  (`vat.startsWith('V-')`) chosen upstream in `CustomerIdentity.tsx` — not a
  real country picker. Non-Venezuelan customers all share one generic
  international format regardless of actual country. A full country-code
  selector is explicitly deferred; this proposal deliberately reuses the
  existing nationality signal to avoid adding new form state. If a future
  requirement needs true per-country masks, the `usePhoneInput` seam is the
  extension point (swap the binary input for a country code).
