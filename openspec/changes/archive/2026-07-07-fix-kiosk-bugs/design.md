# Design: Fix Kiosk Cart and Form Bugs

## Technical Approach
Implement robust handlers for cart clearing on reset, required field validations (minimum length >= 5) for "Dirección" and "Estado" in the customer registration form, dynamic state suggestions fetched from Odoo's `res.country.state` model, and prevention of virtual keyboard blurs on click.

## Architecture Decisions

### Decision: Clear Cart store via XState
- **Choice**: Call `useCartStore.getState().clearCart()` inside the XState machine's `resetContext` action.
- **Alternatives Considered**: Call it inside each onClick cancel handler.
- **Rationale**: Single source of truth. By tying cart clearing to the state machine's transition to `idle` (`resetContext`), we ensure the cart is always cleared regardless of how the transition was triggered (timeout, manual cancellation, or operator restart).

### Decision: Virtual Keyboard Blur prevention
- **Choice**: Use `onMouseDown={(e) => e.preventDefault()}` on all key buttons inside the virtual keyboard, combined with HTML `onBlur` and `e.relatedTarget` checks on input fields.
- **Alternatives Considered**: Global window click tracking.
- **Rationale**: Simpler and respects standard HTML/React event bubbles. If `onMouseDown` prevents default, focus remains in the active input when typing. If the user clicks elsewhere, standard `onBlur` fires, which can hide the keyboard if focus doesn't move to another input.

## Data Flow
```
[CustomerRegister Input Focus] ──→ Sets activeField ──→ Shows AppVirtualKeyboard
       │
       ├─ [Typing on Keyboard] ──→ onMouseDown (preventDefault) ──→ Input retains focus, text updates
       │
       └─ [Clicking Outside] ──→ Input Blur ──→ relatedTarget !== INPUT ──→ Hides Keyboard (activeField: null)
```

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `eu_fex_autopay/src/features/payment/machines/saleMachine.ts` | Modify | Import `useCartStore` and call `clearCart()` inside `resetContext`. |
| `eu_fex_autopay/src/shared/lib/odooRepository.ts` | Modify | Add `fetchStates()` to fetch states from Odoo model `res.country.state`. |
| `eu_fex_autopay/src/features/customer/hooks/useRegisterForm.ts` | Modify | Enforce `min(5)` on `estado` and `street` (Dirección) fields in `registerSchema`. Add `handleStateSelect` action. |
| `eu_fex_autopay/src/features/customer/pages/CustomerRegister.tsx` | Modify | Use `fetchStates()` to show suggestions for `Estado` field. Implement `onBlur` for input fields to hide keyboard. Mark fields as required. |
| `eu_fex_autopay/src/shared/components/AppVirtualKeyboard.tsx` | Modify | Add `onMouseDown={(e) => e.preventDefault()}` to all row button elements. |

## Interfaces / Contracts
```typescript
// res.country.state Odoo representation
export interface OdooState {
  id: number
  name: string
  code: string
}
```

## Testing Strategy
| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit / Integration | Schema validation errors | Run vitest on schema validations in `useRegisterForm.test.ts`. |
| Unit / Integration | Cart clears on RESET | Add test for `saleMachine` transition to idle calling `clearCart()`. |

## Migration / Rollout
No migration required.

## Open Questions
None.
