# Specs: Gift Card Partial Payment (2-Leg Remainder)

## Capability: gift-card-partial-payment (NEW)

### Scenario 1: Full balance covers total (REGRESSION guard — unchanged today's behavior)
- **Given** a user selects "Tarjeta de regalo" and the queried card balance is **>=** the order total
- **When** the card is confirmed
- **Then** the flow behaves exactly as today: `consumedAmount = total`, `remainingAmount = 0`.
- **And** no second payment method is requested.
- **And** the submitted payload has `payments: []` and `giftCard.amount = total` with state `'available'`.

### Scenario 2: Partial balance triggers remainder flow (NEW behavior)
- **Given** a user selects "Tarjeta de regalo" and inputs a valid code
- **And** the queried card balance is **less than** the order total (balance > 0)
- **When** the card is confirmed
- **Then** the flow must NOT block or show the "insufficient balance" error.
- **And** `consumedAmount` must equal the full card balance (`consumedAmount = balance`).
- **And** `remainingAmount` must equal `total - consumedAmount`.
- **And** the user must be prompted to select a second payment method to cover `remainingAmount` before the sale can complete.
- **And** the sale cannot be confirmed/submitted until the second method's payment is captured for `remainingAmount`.

### Scenario 3: Zero balance or invalid/consumed card (unchanged)
- **Given** a user inputs a gift card code
- **When** the queried card balance is `0`, or the card `state` is `consumed`/invalid
- **Then** the flow shows the existing error (card cannot be used) exactly as today.
- **And** no partial-payment prompt is shown; confirmation stays disabled.

### Scenario 4: Multi-leg sale-order payload
- **Given** a partial gift-card payment was completed with a second method for the remainder
- **When** the sale order is submitted (online or enqueued offline)
- **Then** the payload must contain a non-empty `payments[]` array with exactly one leg for the second method covering `remainingAmount`.
- **And** the payload must set `giftCard.amount = consumedAmount` (the consumed balance, NOT the original order total).
- **And** the payload must NOT contain more than these 2 tender legs (gift card + one second method).

### Scenario 5: Fiscal invoice prints both tenders
- **Given** a completed 2-leg sale (gift card + second method)
- **When** the fiscal invoice payload is built (`buildFacturaPayload`)
- **Then** the printed invoice must include a distinct tender line for the gift-card leg (`consumedAmount`) AND a distinct tender line for the second method leg (`remainingAmount`).
- **And** the sum of both printed tender lines must equal the order total.

### Scenario 6: Offline queue replay of a 2-leg order
- **Given** a 2-leg sale order (gift card + second method) is enqueued while offline
- **When** connectivity is restored and the queue replays the order
- **Then** the replayed payload must be submitted verbatim (same `payments[]` leg and same `giftCard.amount` as originally built).
- **And** the backend must reconcile it the same way as an online 2-leg submission (residual-fill via `pay_with_gift_card`).

### Scenario 7: UI shows consumed vs. remaining amounts
- **Given** the partial-payment flow is active (balance < total)
- **When** the payment screen renders
- **Then** it must display "Saldo de la tarjeta" (card balance), "Monto a consumir" (= `consumedAmount`), and "Monto restante" (= `remainingAmount`).
- **And** the confirm action must lead the user to selecting the second payment method (not remain permanently disabled).

## Non-Goals (explicitly OUT of scope for this change)
- **IGTF recalculation on the remainder** — the second-method leg's IGTF treatment is NOT addressed here; existing IGTF logic applies unmodified and may be incorrect for split tenders. Tracked as separate follow-up.
- **Generic N-way split payment** — only exactly 2 legs (gift card + one other method) are supported. No UI or payload support for 3+ tenders.
- **v16 backend parity** (`eu_fex_integration`) — this spec covers the v19 backend (`eu_agroo_fex_integration_v19`) contract only. v16 residual-fill behavior is unverified and out of scope.

## Acceptance Criteria Summary
- [x] Scenario 1 (regression: full balance) passes unchanged.
- [x] Scenario 2 (partial balance) allows completion with a second method.
- [x] Scenario 3 (zero/invalid balance) unchanged.
- [x] Scenario 4 payload carries both `payments[]` and partial `giftCard.amount`.
- [x] Scenario 5 fiscal print shows both tenders.
- [x] Scenario 6 offline replay reconciles identically to online.
- [x] Scenario 7 UI labels present and confirm flow unblocked.
