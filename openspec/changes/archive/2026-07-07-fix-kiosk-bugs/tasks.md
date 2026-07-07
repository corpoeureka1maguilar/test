# Tasks: Fix Kiosk Cart and Form Bugs

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 120-160 lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units
- **Unit 1**: Core implementation (cart reset in XState, states fetch in odooRepository, validation schema).
- **Unit 2**: UI/Component changes (keyboard preventDefault, CustomerRegister input focus/blur, dropdown options).

## Phase 1: Foundation & APIs
- [x] 1.1 Add `fetchStates` query in `eu_fex_autopay/src/shared/lib/odooRepository.ts` to fetch from `res.country.state`.
- [x] 1.2 Update `registerSchema` in `eu_fex_autopay/src/features/customer/hooks/useRegisterForm.ts` to make `estado` and `street` required and `min(5)`.
- [x] 1.3 Add `handleStateSelect` action to `useRegisterForm.ts` to set `estado` value and close focus.
- [x] 1.4 Import `useCartStore` in `eu_fex_autopay/src/features/payment/machines/saleMachine.ts` and clear the cart in the `resetContext` action.

## Phase 2: UI & Component wiring
- [x] 2.1 Add `onMouseDown={(e) => e.preventDefault()}` on row button elements in `eu_fex_autopay/src/shared/components/AppVirtualKeyboard.tsx`.
- [x] 2.2 In `eu_fex_autopay/src/features/customer/pages/CustomerRegister.tsx`, add `onBlur` handlers to `name`, `phone`, `email`, `estado`, and `street` inputs to clear `activeField` unless focus moves to another input.
- [x] 2.3 Fetch Odoo states on mount in `CustomerRegister.tsx` (with fallback list of Venezuelan states).
- [x] 2.4 Render the suggestions dropdown for the `Estado` input in `CustomerRegister.tsx` when focused.
- [x] 2.5 Mark `Estado` and `Dirección` fields with `required` and asterisk `*` in the UI.

## Phase 3: Testing & Verification
- [ ] 3.1 Run `npm test` to verify no existing tests are broken.
- [x] 3.2 Add test in `useRegisterForm.test.ts` (if exists) or manual verification of validation errors.
- [x] 3.3 Verify manual cancellation on kiosk clears the cart.
- [x] 3.4 Verify virtual keyboard hides correctly when clicking outside.
