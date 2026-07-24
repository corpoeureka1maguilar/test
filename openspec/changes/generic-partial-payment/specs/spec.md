# Delta Specs: generic-partial-payment

Consolidated single-file delta covering 4 domains (per explicit task path). Capabilities per `proposal.md`: `generic-partial-payment` (NEW), `fiscal-tender-code-mapping` (NEW), `gift-card-partial-payment` (MODIFIED), `payment-flow` (MODIFIED).

---

## Capability: generic-partial-payment (NEW)

### Requirement: N-Leg Payment Composition
The system MUST support a sale composed of an optional gift-card leg plus N sequential VPOS legs (`legs: PaymentLeg[]`), closing only when `remainingAmount === 0`.

#### Scenario: Gift card partial + 2+ sequential VPOS legs
- GIVEN a gift-card leg leaves `remainingAmount > 0`
- WHEN VPOS terminal A charges part of the remainder and VPOS terminal B charges the rest
- THEN `legs` MUST contain 3 entries (gift card + A + B) summing to the order total
- AND the sale MUST NOT close until the sum equals total.

#### Scenario: 2+ sequential VPOS legs, no gift card
- GIVEN no gift card was selected
- WHEN VPOS A charges part of the total and VPOS B charges the remainder
- THEN `legs` MUST contain 2 VPOS entries summing to total, with no gift-card entry.

#### Scenario: Same VPOS method reselected for a second leg
- GIVEN VPOS method "Terminal Banesco" was already used for leg 1 with remainder left
- WHEN the cashier selects "Terminal Banesco" again for the next leg
- THEN the selection MUST be accepted and produce a second independent `PaymentLeg` for that method.

#### Scenario: Gift card partial + exactly 1 VPOS leg (existing behavior preserved)
- GIVEN a gift-card leg leaves `remainingAmount > 0`
- WHEN one VPOS charge covers the full remainder
- THEN the sale MUST close with exactly 2 legs, identical to today's shipped behavior.

### Requirement: Leg Cap Enforcement
The system MUST enforce a configurable maximum number of legs per sale (default N=4; adjustable — see Assumptions).

#### Scenario: Cap reached blocks a new leg
- GIVEN a sale already has 4 legs (the default cap) and `remainingAmount > 0`
- WHEN the cashier attempts to select a method for a 5th leg
- THEN the system MUST block adding the leg and show a clear message; existing legs and `remainingAmount` MUST remain intact.

### Requirement: VPOS Leg Failure Recovery Preserves State
A failed or timed-out VPOS charge mid-sale MUST NOT discard previously completed legs or the current `remainingAmount`.

#### Scenario: Timeout/rejection mid multi-leg sale
- GIVEN a sale has 1+ completed legs and `remainingAmount > 0`
- WHEN the next VPOS charge times out or is rejected (`codRespuesta !== '00'`)
- THEN `legs` and `remainingAmount` MUST remain exactly as before the failed attempt
- AND the cashier MUST be able to retry the same or a different method without re-entering prior legs.

### Requirement: IGTF Calculated Per Leg
Each leg's IGTF MUST be computed as `calcIgtf(method, legAmount)`, never hardcoded.

#### Scenario: IGTF reflects each leg's own method
- GIVEN a sale with 2+ legs of different methods and amounts
- WHEN the sale-order payload is built
- THEN each leg's IGTF field MUST equal `calcIgtf(leg.method, leg.amount)` computed independently
- AND the current result MAY be 0 for all legs today (no production method has `applyIgtf=true`) but the code path MUST NOT hardcode 0.

### Requirement: Regression — Existing Single/Two-Leg Flows Unaffected
A sale paid with a single method MUST behave byte-identically to pre-change behavior.

#### Scenario: Single VPOS-only sale unaffected
- GIVEN a sale with no gift card, paid with one VPOS charge covering the full total
- WHEN the charge confirms (`codRespuesta === '00'`)
- THEN the sale MUST close immediately (no loop-back to method selection), producing the same payload shape as today.
(Gift-card full-balance regression is covered by `gift-card-partial-payment` Scenario "Full balance covers total", unchanged.)

---

## Capability: fiscal-tender-code-mapping (NEW)

### Requirement: Real printer_code Sourced Per Method
Each leg's fiscal tender line MUST use its method's real `printer_code` fetched from Odoo, not a hardcoded value.

#### Scenario: Each leg reports its own printer_code
- GIVEN a sale with 2 legs of different methods, each with a distinct `printerCode` ("05", "07")
- WHEN `buildFacturaPayload` runs
- THEN the payload MUST contain a tender line per distinct code with the leg's real code — never `'01'` for both.

### Requirement: Defensive Accumulation by Tender Code
Amounts MUST accumulate per tender code; a later leg MUST NOT overwrite an earlier one.

#### Scenario: Distinct codes produce distinct lines
- GIVEN 2 legs with different `printerCode`s
- WHEN the payload is built
- THEN there MUST be 2 separate tender lines, each equal to its leg's amount, summing to total.

#### Scenario: Shared code accumulates instead of overwriting
- GIVEN 2 methods misconfigured in Odoo to share the same `printerCode`
- WHEN both are used as legs in one sale
- THEN their amounts MUST be summed into a single tender line for that code, not the last write winning.

### Requirement: Empty printer_code Blocks Method From Split
A method with empty/unset `printerCode` MUST be excluded from selection, with no silent fallback code.

#### Scenario: Method without printer_code is not selectable
- GIVEN a VPOS method exists with `printerCode` empty or `null`
- WHEN the cashier opens method selection for any leg
- THEN that method MUST NOT appear as selectable (or MUST be blocked with a clear message if shown)
- AND the system MUST NOT invent or default a code for it.

---

## Delta for gift-card-partial-payment (MODIFIED)

> Legacy spec (`openspec/specs/gift-card-partial-payment/spec.md`) uses a flat `Scenario N` list under one capability heading rather than `Requirement` blocks. Restructured below into 2 requirements to comply with delta format, preserving all 7 original scenarios (see Assumptions).

### Requirement: Gift Card as an Optional Leg With Remainder
The system MUST let a gift-card leg cover part of the total, leaving `remainingAmount` payable by any number of subsequent legs (no longer capped at exactly one second method).
(Previously: capped at exactly 2 legs total — gift card + one closing method.)

#### Scenario: Full balance covers total (regression, unchanged)
- GIVEN the queried card balance is `>= total`
- WHEN the card is confirmed
- THEN `consumedAmount = total`, `remainingAmount = 0`, no second leg requested, payload unchanged from today.

#### Scenario: Partial balance triggers remainder flow
- GIVEN the queried card balance is `> 0` and `< total`
- WHEN confirmed
- THEN `consumedAmount = balance`, `remainingAmount = total - consumedAmount`
- AND the cashier MUST be prompted for one or more additional legs (not just one) until `remainingAmount === 0`.

#### Scenario: Zero balance or invalid/consumed card (unchanged)
- GIVEN balance is `0` or card state is `consumed`/invalid
- WHEN queried
- THEN the existing error blocks confirmation exactly as today; no partial-payment prompt shown.

#### Scenario: UI shows consumed vs. remaining amounts
- GIVEN the partial-payment flow is active
- WHEN the payment screen renders
- THEN it MUST display card balance, consumed amount, and remaining amount, and unblock the flow toward selecting the next leg.

### Requirement: Multi-Leg Payload and Fiscal Print Contract for Gift Card Leg
The sale-order payload and fiscal print MUST represent the gift-card leg alongside any number of other legs, with IGTF computed per leg (not forced to 0).
(Previously: exactly one closing leg allowed; remainder leg's `montoIgtf` was forced to `0`.)

#### Scenario: Multi-leg sale-order payload
- GIVEN a gift-card leg plus 1+ additional legs completed the sale
- WHEN the sale order is submitted (online or offline queue)
- THEN `payments[]` MUST contain one entry per non-gift-card leg, `giftCard.amount = consumedAmount`
- AND each leg's IGTF MUST be `calcIgtf(method, legAmount)`, not hardcoded `0`.

#### Scenario: Fiscal invoice prints every tender leg
- GIVEN a completed multi-leg sale (gift card + N legs)
- WHEN `buildFacturaPayload` runs
- THEN the payload MUST include a distinct tender line per leg's real `printerCode` (accumulated per code per `fiscal-tender-code-mapping`), summing to total.

#### Scenario: Offline queue replay of a multi-leg order
- GIVEN a multi-leg order is enqueued while offline
- WHEN connectivity is restored and the queue replays it
- THEN the payload MUST be submitted verbatim, reconciled the same way as an online submission.

---

## Delta for payment-flow (MODIFIED)

### Requirement: Gift-card selection no longer hard-blocks on insufficient balance
The system MUST allow gift-card payments to proceed with one or more additional legs when balance is insufficient but greater than zero.
(Previously: only a single second method was allowed after the gift-card leg.)

#### Scenario: Gift-card selection no longer hard-blocks on insufficient balance
- GIVEN `0 < balance < total`
- WHEN this change is applied
- THEN the hard block is removed and the flow proceeds to select additional legs until `remainingAmount === 0`
- AND `balance >= total` and `balance === 0`/invalid cases remain unchanged.

### Requirement: VPOS Charge as Intermediate Leg When Remainder Exists
A successful VPOS charge MUST only close the sale when `remainingAmount === 0`; otherwise it loops back to method selection.
(New — generalizes the `GIFT_CARD_PARTIAL` loop-back pattern to VPOS charges.)

#### Scenario: VPOS charge with remainder loops back to method selection
- GIVEN a VPOS charge confirms (`codRespuesta === '00'`) and leaves `remainingAmount > 0`
- WHEN the confirmation is processed
- THEN the system MUST return to method selection with `legs` and `remainingAmount` updated, and MUST NOT navigate to `/resultado`.

#### Scenario: VPOS charge with no remainder closes the sale (regression)
- GIVEN a VPOS charge confirms and `remainingAmount === 0`
- WHEN processed
- THEN the sale MUST close and navigate to `/resultado`, exactly as today for single-method sales.

### Requirement: Same VPOS Method Selectable for Multiple Legs
`PaymentSelect` MUST allow choosing a method already used in a prior leg of the same sale.

#### Scenario: Re-selecting an already-used VPOS method
- GIVEN a sale has a completed leg using method "Terminal A"
- WHEN the cashier opens method selection again with `remainingAmount > 0`
- THEN "Terminal A" MUST remain selectable and produce a new independent leg.

### Requirement: Method Availability Filtered by printer_code
`PaymentSelect` MUST exclude methods without a configured `printerCode` from the selectable list.

#### Scenario: Method without printerCode hidden from selection
- GIVEN a VPOS method has empty/unset `printerCode`
- WHEN `PaymentSelect` renders the method list for any leg
- THEN that method MUST NOT be offered for selection.

---

## Assumptions & Decisions Made (explicit — not hidden)

1. **Legacy spec format mismatch**: `openspec/specs/gift-card-partial-payment/spec.md` uses a flat `Scenario N` list, not `Requirement` blocks. I restructured its 7 scenarios into 2 `Requirement` blocks to satisfy the delta format the archive step expects, without dropping any original scenario. Flag for `sdd-design`/`sdd-archive`: confirm this restructuring is acceptable when merging back into `openspec/specs/`.
2. **Leg cap default**: proposal marks this as non-blocking and design-owned ("3-4"). I picked **N=4** to write a concrete, testable scenario (Scenario 11 requested). This is a placeholder value, not a spec-level decision — `sdd-design` MUST confirm or override it.
3. **Retry state name left undecided on purpose**: proposal's Open Questions asks whether retry returns to `selectingMethod` or a dedicated `retryLeg` state. The spec intentionally describes the retry requirement state-agnostically ("returns to method selection, preserving legs/remainingAmount") to avoid a spec agent making an implementation/design decision that belongs to `sdd-design`.
4. **Regression scenario placement**: the proposal's Success Criteria demands a VPOS-only regression guard, but no existing spec covered it (only gift-card-full-balance regression existed). I added it as a new scenario under `generic-partial-payment` rather than modifying `payment-flow`'s existing requirements, to avoid overwriting content that isn't actually changing.
5. **Size budget**: this artifact exceeds the skill's normal 650-word guideness soft budget given the task's explicit requirement to cover 11 concrete scenarios across 4 capabilities without losing legacy scenario content. Documented here as a conscious trade-off, not an oversight.
