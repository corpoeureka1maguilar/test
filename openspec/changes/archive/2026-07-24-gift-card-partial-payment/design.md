# Design: Gift Card Partial Payment (2-Leg Remainder)

## Technical Approach

Model exactly TWO legs — gift card (partial consume) + one second method for the remainder — by extending the existing `saleMachine` context, NOT introducing a generic N-way split. The gift-card leg is captured in context, the machine returns to `selectingMethod` for the remainder, and the SAME `saleAttemptId` carries both legs into `processing`. Payload and print builders gain a partial-aware branch keyed on `method.id !== -999 && giftCard.state === 'available'`. Backend v19 residual-fill already reconciles the 2-leg order (see proposal), so offline replay works verbatim once the builder is fixed.

## Architecture Decisions

### Decision: Reuse `selectingMethod`/`enteringDetails`, no new state
**Choice**: Add context fields `giftCardLeg` + `remainingAmount` and one event `GIFT_CARD_PARTIAL`; loop back through existing states.
**Alternatives**: (a) dedicated `enteringRemainder` state; (b) generic `payments[]` accumulator.
**Rationale**: The flow is structurally identical to a normal method selection — only the effective amount changes. A new state duplicates transitions/guards. Generic array is speculative (proposal Out of Scope). Looping back re-fires `ensureSaleAttemptId` which is `?? randomUUID()`, so the dedup id is PRESERVED across both legs — critical invariant.

### Decision: Discriminate partial by `method.id !== -999 && giftCard.state === 'available'`
**Choice**: No new flag; the combination (normal method + an available gift card in context) uniquely identifies a remainder leg.
**Alternatives**: explicit `isPartial` boolean threaded through builders.
**Rationale**: Today an `available` gift card only ever coexists with method `-999`; `new` = card purchase. The tuple is already unambiguous, so no signature noise. Full-card (`-999`) and card-purchase (`new`) paths stay byte-identical.

### Decision: Second-leg amount comes from `remainingAmount`, IGTF stays 0
**Choice**: `PaymentForm` passes `context.remainingAmount ?? total` as the effective total; the partial payload/print branch is authoritative and forces `montoIgtf = 0` on the remainder.
**Rationale**: Proposal excludes IGTF-on-remainder. Controlling it in the builder (not trusting `payment.igtfAmount`) guarantees we neither design nor accidentally apply remainder IGTF, while single-method IGTF is untouched.

## Data Flow

    GiftCardView (balance < total)
        │  GIFT_CARD_PARTIAL { giftCard(amount=consumedUSD), remainingAmount }
        ▼
    enteringDetails ──► selectingMethod (giftCard option hidden)
        │  SELECT_METHOD (normal) → enteringDetails (form uses remainingAmount)
        │  SUBMIT_PAYMENT { payment=remainder }
        ▼
    processing ──► buildSaleOrderPayload(payment, method, giftCardLeg)
        │            → payments:[remainder]  +  giftCard.amount=consumedUSD
        ▼
    printing ──► buildFacturaPayload(..., remainderBs, splitTender:{15, consumedBs})
        │            → pago01=remainderBs + pago15=consumedBs
        ▼
    success   (offline path: enqueuingOffline replays same 2-leg payload)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `machines/saleMachine.ts` | Modify | Add `giftCardLeg`/`remainingAmount` to context+reset+initial; add `GIFT_CARD_PARTIAL` event + `setGiftCardLeg` action; `enteringDetails` transition → `selectingMethod`; pass `giftCardLeg ?? giftCard` into `processing`, `enqueuingOffline` (ADD giftCard to its input — currently missing) and `printing` |
| `hooks/useGiftCardPayment.ts` | Modify | Compute `consumedAmountUSD=min(balance,orderTotalUSD)`, `remainingBs=total−consumedAmountUSD*rate`; remove hard block (l.56-59); submit dispatches full (`SUBMIT_PAYMENT`, `-999`) OR partial (`GIFT_CARD_PARTIAL`, navigate `/pago`) |
| `components/GiftCardPaymentView.tsx` | Modify | Replace disabled/insufficient warning with consumed-vs-remaining rows + "Continuar a elegir método" button |
| `pages/PaymentForm.tsx` | Modify | `effectiveTotal = context.remainingAmount ?? total`; feed to `usePaymentAmounts`/`detailsForm` |
| `pages/PaymentSelect.tsx` | Modify | Hide gift-card option when `context.giftCardLeg` set |
| `shared/lib/saleOrderPayload.ts` | Modify | Partial branch (l.91) |
| `shared/lib/printPayload.ts` | Modify | `buildFacturaPayload` optional `splitTender` |
| `cart/components/AppStepper.module.css` | Modify | `.companyLogo` height 88→~120px, bump max-width |

## Interfaces / Contracts

**saleOrderPayload.ts — before/after (l.37, l.91)**
```ts
// before
const isPayingWithGiftCard = method.id === -999 && giftCard?.state === 'available'
payments: isPayingWithGiftCard ? [] : [{ ...full leg... }]

// after
const isFullGiftCard = method.id === -999 && giftCard?.state === 'available'
const isPartialRemainder = method.id !== -999 && giftCard?.state === 'available'
const consumedUSD = giftCard?.amount ?? 0
const remainderBs = round2(totalBs - consumedUSD * globalRate) // IVA in, no IGTF
// formattedGiftCard.amount already = consumedUSD (hook set it)
payments: isFullGiftCard ? [] : [{
  id: randomUUID(), isChange: false, date: ..., ref: payment.reference || '',
  amount:    isPartialRemainder ? remainderBs : paymentAmount,
  currency:  method.currencyId, rate: globalRate, journal: method.journalId,
  method:    method.id,
  montoIgtf: isPartialRemainder ? 0 : paymentIgtf
}]
```

**printPayload.ts — extend buildFacturaPayload**
```ts
buildFacturaPayload(..., totalAmount, stationLabel = 'Autopago',
                    splitTender: { code: string; amountBs: number } | null = null)
// existing: payload['pago'+codeVal.slice(0,2)] = fixNumberForAPI(totalAmount)
if (splitTender) payload['pago' + splitTender.code] = fixNumberForAPI(splitTender.amountBs)
// partial print call: totalAmount = remainderBs (pago01), splitTender = { code:'15', amountBs: consumedBs }, consumedBs = totalBs − remainderBs
const igtfAmount = splitTender ? 0 : calcIgtf(method, totalAmount)
// montoigtf forced to 0 whenever splitTender is set (remainder leg), regardless of
// method.applyIgtf — matches saleOrderPayload.ts's isPartialRemainder ? 0 : paymentIgtf.
// Fixed 2026-07-23 following verify-report WARNING #1 (payload/print IGTF inconsistency);
// RED test added in printPayload.test.ts before the fix.
```
Single-tender path with `splitTender = null` stays identical.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `buildSaleOrderPayload` partial: `payments[0].amount==remainderBs`, `montoIgtf==0`, `giftCard.amount==consumedUSD`; full `-999`→`payments:[]`; normal unchanged | Vitest, mock stores |
| Unit | `buildFacturaPayload` splitTender → `pago15+pago01` sum == total; null → unchanged | Vitest |
| Unit | `useGiftCardPayment` math + full-vs-partial dispatch | Vitest + RTL hook |
| Machine | `enteringDetails --GIFT_CARD_PARTIAL--> selectingMethod` persists `giftCardLeg`; second `SUBMIT_PAYMENT`→`processing` carries both legs; `saleAttemptId` stable across the loop | `createActor` |

## Migration / Rollout
No migration. No backend change. Rollback = revert frontend commits (restores full-balance-required behavior).

## Open Questions
- [x] RESOLVED (user decision): Remainder method that itself applies IGTF → allow ANY method and force `montoIgtf = 0` on the remainder (do NOT filter methods, do NOT recalculate IGTF). Matches "IGTF-on-remainder out of scope" literally. Accepted risk: if a cashier picks an IGTF-applying method for the remainder, IGTF is not collected on that leg (documented follow-up).
  - [x] FOLLOW-UP FIXED (2026-07-23, verify-report WARNING #1): this "force to 0" rule was only
    enforced in `saleOrderPayload.ts`; `printPayload.ts`'s `buildFacturaPayload` computed
    `montoigtf` via `calcIgtf(method, totalAmount)` unconditionally, so a remainder method with
    `applyIgtf: true` would print a nonzero IGTF while Odoo received `montoIgtf: 0` for the same
    leg. Fixed with a RED test (`printPayload.test.ts`, "forces montoigtf to 0 on the remainder
    leg even when the second method applies IGTF") + `igtfAmount = splitTender ? 0 :
    calcIgtf(...)` in `buildFacturaPayload`. Full suite green (355/355), typecheck clean.
- [x] RESOLVED (T0.1, 2026-07-23): `'15'` is confirmed at the code level — it is the EXISTING
  tender code already used in shipped production code for the full-gift-card path
  (`printPayload.ts:126`, commit `9bb69cc`), not a fresh guess. Use `'15'` for the gift-card
  leg in `splitTender` (T2.1/T2.2) — no change from what this design already specifies.
- [ ] Split-tender fiscal print (`pago15`+`pago01`) must still be validated on real hardware
  before release (T4.2, unchanged release gate) — the `pago<code>` table itself belongs to the
  fiscal printer vendor's own protocol (`ServWebImpresion`, reached via `printer-agent`), which
  is external to all accessible repos and cannot be fully confirmed from code alone.
