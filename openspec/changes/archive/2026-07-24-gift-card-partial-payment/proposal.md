# Proposal: Gift Card Partial Payment (2-Leg Remainder)

## Intent
Today gift-card payment in the autopay kiosk REQUIRES the card balance to cover the full order total. If the balance is short, the flow blocks and only offers "use another card". The business wants **partial payment**: consume the full gift-card balance and charge the **remaining amount** with a second payment method, in the same sale. The v19 backend already reconciles this (residual-fill in `eu_pos_gift_card/models/models.py:59-62`); the block is 100% frontend.

## Scope

### In Scope
- Frontend flow: gift-card partial consume + one second method for the remainder.
- Multi-leg sale-order payload: send non-empty `payments[]` for the remainder AND `giftCard.amount = consumedAmount`.
- Multi-tender fiscal printing (split-tender) in `buildFacturaPayload` — printer confirmed to support it.
- UI for the remainder: show consumed vs. remaining, prompt for the second method.
- Small cosmetic tweak: larger logo on the referenced payment screen.

### Out of Scope
- **IGTF recalculation on the remainder** — explicit exclusion; separate follow-up.
- Generic N-way split payment (only exactly 2 legs).
- v16 backend parity (`eu_fex_integration`) — not verified, separate work.
- Backend `_compute_x_amounts` residual fix — non-blocking follow-up.

## Capabilities

### New Capabilities
- `gift-card-partial-payment`: 2-leg flow, remainder calculation, multi-leg payload, split-tender print.

### Modified Capabilities
- `payment-flow`: gift-card no longer blocks when balance < total; remainder handoff to a second method.

## Approach
Extend the XState `saleMachine` for exactly 2 legs (gift card + one method), NOT a generic split. Compute `consumedAmount = min(balance, total)` and `remainingAmount = total - consumedAmount` in `useGiftCardPayment.ts`, removing the hard block. Payload builder emits both legs; fiscal print writes multiple `pagoXX` keys. Matches the backend's existing 2-leg contract, so offline replay works for free.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `src/features/payment/hooks/useGiftCardPayment.ts` | Modified | Remove block; compute consumed/remaining |
| `src/features/payment/machines/saleMachine.ts` | Modified | Add remainder concept (2 legs) |
| `src/shared/lib/saleOrderPayload.ts:91` | Modified | Emit remainder `payments[]` + partial `giftCard.amount` |
| `src/shared/lib/printPayload.ts:116-157` | Modified | Multi-tender `buildFacturaPayload` |
| Payment screen UI | Modified | Remainder UI + larger logo |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Split-tender print regressions | Med | User confirmed printer support; validate on hardware |
| v16 backend lacks residual-fill | Med | Out of scope; verify before v16 rollout |
| IGTF on remainder wrong if reused later | Low | Explicitly excluded; documented follow-up |

## Rollback Plan
Revert the frontend commits. Backend is unchanged, so reverting restores the current full-balance-required behavior with no data migration.

## Dependencies
- v19 backend residual-fill reconciliation (already present, no change).

## Success Criteria
- [ ] Gift card with balance < total completes as partial + second method in one sale.
- [ ] Full card balance consumed; remainder charged correctly.
- [ ] Fiscal invoice prints both tenders.
- [ ] Offline queue replays the 2-leg order.
