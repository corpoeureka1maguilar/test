# Proposal: Fix Kiosk Cart and Form Bugs

## Intent
Solve critical kiosk bugs: cart not clearing on manual cancel, missing mandatory validation for address/state fields, and keyboard not hiding on blur.

## Scope
### In Scope
- Clear Zustand cart store when XState machine transitions to `idle` via `RESET`.
- Make "Dirección" and "Estado" fields mandatory with a 5-character minimum in Zod.
- Fetch Venezuelan states from Odoo's `res.country.state` (fallback to hardcoded list if offline/failed).
- Render a state suggestions dropdown when typing in "Estado" field.
- Prevent virtual keyboard buttons from stealing focus from inputs using `preventDefault` on `mousedown`.
- Hide keyboard on input blur if focus is not shifted to another input.

### Out of Scope
- Modifying Odoo backend database models.
- Adding physical keyboard support.

## Capabilities
### Modified Capabilities
- `customer-registration`: Validation of address/state fields and autocomplete/dropdown of Venezuelan states from Odoo.
- `payment-flow`: Reliable cart cleanup upon manual cancellations.

## Approach
- Update XState `resetContext` action in `saleMachine.ts` to call `useCartStore.getState().clearCart()`.
- Add `fetchStates` query to `odooRepository.ts`.
- Update `registerSchema` in `useRegisterForm.ts`.
- Modify `AppVirtualKeyboard.tsx` buttons to prevent default on `mousedown`.
- Modify `CustomerRegister.tsx` to handle `onBlur` for input fields, showing the state suggestions dropdown, and styling inputs as required.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `src/features/payment/machines/saleMachine.ts` | Modified | Clear cart on `resetContext` |
| `src/shared/lib/odooRepository.ts` | Modified | Add `fetchStates` method |
| `src/features/customer/hooks/useRegisterForm.ts` | Modified | Add required and min(5) rules |
| `src/features/customer/pages/CustomerRegister.tsx` | Modified | Add state autocomplete & inputs `onBlur` |
| `src/shared/components/AppVirtualKeyboard.tsx` | Modified | Add preventDefault on key mousedown |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Odoo offline fails to fetch states | Low | Fallback to hardcoded list |

## Rollback Plan
Run `git checkout` on modified files.

## Success Criteria
- [ ] Cart clears on manual cancel from catalog, identity, and payment screens.
- [ ] Register form requires state and street with length >= 5.
- [ ] State field shows suggestions from Odoo's `res.country.state`.
- [ ] Keyboard hides when clicking outside inputs and doesn't close when typing.
