# Exploration: fix-kiosk-bugs

### Current State
1. **Cart State Cleanup**: Manual cancellation in screens like `ProductCatalog`, `CustomerIdentity`, and `PaymentResult` sends the `RESET` event to the state machine and navigates to `/`, but it does not clear the Zustand cart store. Only the inactivity timer in `RootLayout` clears it.
2. **Form Validation**: `estado` and `street` fields are optional or do not enforce a 5-character minimum in Zod. The state is just a text field, with no integration with Odoo's `res.country.state`.
3. **Virtual Keyboard**: The keyboard remains visible because blur events on inputs are not handled. Adding blur directly would hide the keyboard when typing since clicking keyboard keys blurs the active input.

### Affected Areas
- `eu_fex_autopay/src/features/payment/machines/saleMachine.ts` — needs cart clearing on reset
- `eu_fex_autopay/src/features/customer/hooks/useRegisterForm.ts` — needs updated validation schema and state select handlers
- `eu_fex_autopay/src/features/customer/pages/CustomerRegister.tsx` — needs inputs onBlur, dropdown state selection, and required visual/DOM properties
- `eu_fex_autopay/src/shared/lib/odooRepository.ts` — needs a query to fetch states from Odoo (`res.country.state`)
- `eu_fex_autopay/src/shared/components/AppVirtualKeyboard.tsx` — needs `onMouseDown` preventDefault to prevent blurring inputs

### Approaches
1. **Integrated Machine reset & Input Blur mitigation** — Clear Zustand cart store inside `resetContext` in XState. Add `onMouseDown={(e) => e.preventDefault()}` on keyboard keys to allow input blur detection on inputs without breaking typing. Fetch Odoo states.
   - Pros: Elegant, handles all cancellation entry points, input never loses focus while typing.
   - Cons: None.
   - Effort: Medium.

### Recommendation
Use Approach 1 as it is standard and cleanly resolves all three issues.

### Risks
- None.

### Ready for Proposal
Yes.
