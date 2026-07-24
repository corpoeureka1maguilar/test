
# Tasks: Gift Card Partial Payment (2-Leg Remainder)

Backend: openspec (file-based). Mirrored to engram at `sdd/gift-card-partial-payment/tasks`.
Strict TDD is ACTIVE. Test runner: `npm test` (Vitest). Every implementation task is preceded
by its RED (failing test) task; do not write implementation before the test fails for the
right reason. Follow the repo's red-green convention: show red, wait, then make it green.

Legend: `[P]` = can run in parallel with sibling tasks in the same phase. `[S]` = must run
sequentially (has a hard dependency on a prior task in this file).

---

## Phase 0 — Blocking prerequisite (sequential, before any print-branch code)

### T0.1 [S] Confirm real gift-card tender/journal code with printer config — DONE (2026-07-23)
- **Satisfies**: Design Open Questions (unresolved item), gates Scenario 5.
- **Action**: Before implementing `buildFacturaPayload`'s `splitTender` branch, verify against
  the actual printer/journal configuration (ESC/POS agent config or backend journal table)
  whether `'15'` is really the gift-card tender code, or find the correct one.
- **Result — CONFIRMED at code level, `'15'` is correct, no change needed**:
  - `src/shared/lib/printPayload.ts:126` already has
    `const codeVal = method.id === -999 ? '15' : '01'` — this is NOT a new assumption invented
    during SDD planning, it is the EXISTING, shipped production code for the full-gift-card
    path (`method.id === -999`), introduced in commit `9bb69cc` ("feat: implement gift card
    system with secure queue_job..."), same author as this change. It has been live since
    2026-07-07, well before this SDD change started.
  - Odoo backend (`eu_agroo_fex_integration_v19/eu_pos_gift_card`) confirms gift cards have
    their OWN dedicated `account.journal` via `x_gift_card_journal_id` (configurable system
    parameter, `eu_pos_gift_card.x_gift_card_journal`) — i.e. gift card is modeled as a
    first-class, distinct tender in the backend too, not overloaded onto another journal.
    This is consistent with (does not contradict) a dedicated fiscal-printer tender code.
  - The `pago<code>` codes (`01`, `15`, etc.) are a convention of the FISCAL PRINTER's own
    `ServWebImpresion` protocol (reached via the local `printer-agent` bridge, see
    `printer-agent/README.md`) — that vendor protocol table is external to all accessible
    repos (`eu_agroo_fex_integration_v19`, `printer-agent`, `printer-validator`); none of them
    document a `pago01..pago15` meaning table. This detail cannot be confirmed 100% from code
    alone.
  - **Residual uncertainty (explicitly NOT this task's job to close)**: whether the physical
    fiscal printer firmware actually prints `pago15` as a distinct "gift card" tender line (vs.
    silently mapping it to something else) can only be confirmed on real hardware. Tasks.md
    already schedules this as a separate, explicit release gate — **T4.2 Hardware validation
    of split-tender fiscal print** — so this was never expected to be closed by static analysis.
  - **Conclusion**: use `'15'` for the gift-card leg in T2.1/T2.2 exactly as design.md specifies
    — do NOT invent a different code. Phase 2 (`printPayload.ts` tests/impl) is UNBLOCKED to
    start with full code-level certainty; T4.2 remains the outstanding hardware confirmation
    gate before release (unchanged from original plan).

---

## Phase 1 — Foundational, independent files (parallel among themselves)

### T1.1 [P] RED: saleMachine — failing tests for GIFT_CARD_PARTIAL flow — DONE (2026-07-23)
- **File**: `machines/saleMachine.test.ts` (or equivalent existing test file for the machine)
- **Satisfies**: Scenario 2, Scenario 4, Scenario 6 (offline leg fix), design Testing Strategy row "Machine"
- Write failing tests asserting:
  1. `enteringDetails` --`GIFT_CARD_PARTIAL`--> `selectingMethod`, and `context.giftCardLeg` +
     `context.remainingAmount` are persisted after the transition.
  2. A second `SUBMIT_PAYMENT` from `selectingMethod`/`enteringDetails` moves to `processing`
     with BOTH legs available in context (`giftCardLeg` and the new `payment`/`method`).
  3. `saleAttemptId` is stable (same UUID) across the full loop (first entry into
     `enteringDetails` through the second `SUBMIT_PAYMENT`) — regression guard per design
     Decision "Reuse selectingMethod/enteringDetails".
  4. `enqueuingOffline` actor input receives `giftCardLeg ?? giftCard` (currently only
     `giftCard` is passed — this is the latent bug fix, engram #423). Assert the input object
     is present and non-null when a partial leg exists.
  5. Regression: full-balance path (`method.id === -999`) and normal single-method path are
     unaffected — no `GIFT_CARD_PARTIAL` event fired, existing transitions unchanged.
- **Result**: Added 5 new tests to `saleMachine.test.ts` (new describe block "gift card partial
  payment (2-leg remainder, GIFT_CARD_PARTIAL)"). Confirmed RED — all 5 failed with `undefined`
  where `giftCardLeg`/`remainingAmount`/event were expected (the correct reason: feature not
  implemented yet), 18/18 pre-existing tests stayed green.

### T1.2 [S] GREEN: saleMachine — implement GIFT_CARD_PARTIAL
- **File**: `machines/saleMachine.ts`
- **Depends on**: T1.1 (must be red first)
- **Satisfies**: Scenario 2, Scenario 4, Scenario 6, design File Changes row 1, design Decisions
  "Reuse selectingMethod/enteringDetails" and "Discriminate partial by method.id !== -999 &&
  giftCard.state === 'available'"
- Add `giftCardLeg` and `remainingAmount` to context (+ reset + initial context).
- Add `GIFT_CARD_PARTIAL` event + `setGiftCardLeg` action.
- Add `enteringDetails` → `selectingMethod` transition on this event.
- Pass `giftCardLeg ?? giftCard` into the `processing`, `enqueuingOffline` (bug fix — currently
  missing), and `printing` actor inputs.
- Run `npm test` until green. Do not touch unrelated transitions/guards.
- **Result — DONE (2026-07-23)**: `machines/saleMachine.ts` updated:
  - Context: added `giftCardLeg: GiftCard | null` + `remainingAmount: number | null` (initial
    context + `resetContext`).
  - Event: added `GIFT_CARD_PARTIAL { giftCard: GiftCard; remainingAmount: number }`.
  - Action: added `setGiftCardLeg` (assigns both fields from the event, does not touch
    `activePayment`/`giftCard`, which belong to the second leg).
  - Transition: `enteringDetails` now handles `GIFT_CARD_PARTIAL` → `selectingMethod`.
  - Wired `giftCardLeg ?? giftCard` into `processing`, `printing`, and (newly) `enqueuingOffline`
    invoke `input` functions.
  - Extra fix beyond the literal input-wiring: `enqueueOfflineOrder`'s actor body previously
    called `buildSaleOrderPayload(..., null)` unconditionally (hardcoded null gift card) — now
    passes the `giftCard` from its (now-extended) input, so the offline-enqueued payload keeps
    the gift-card leg for replay (Scenario 6). Also simplified `submitPaymentToOdoo`'s branching
    from `method.id === -999 && giftCard` to just `giftCard` (truthy check) — this actor's
    branch decides only whether to forward `giftCard` into `buildSaleOrderPayload`; the
    full-vs-partial discrimination itself lives inside `buildSaleOrderPayload` (T1.4), keyed on
    `method.id` + `giftCard.state`, so this simplification threads `giftCardLeg` through for the
    partial case without changing full-gift-card behavior (still verified byte-identical by the
    T1.1 regression test).
  - `npm test` on `saleMachine.test.ts`: 23/23 green (18 pre-existing + 5 new).

### T1.3 [P] RED: buildSaleOrderPayload — failing tests for partial branch + regressions
- **File**: `shared/lib/saleOrderPayload.test.ts`
- **Satisfies**: Scenario 1 (regression), Scenario 4, design Testing Strategy row 1, design
  Interfaces/Contracts "saleOrderPayload.ts — before/after"
- Write failing tests asserting:
  1. Partial branch: `payments[0].amount === remainderBs` (computed as
     `round2(totalBs - consumedUSD * globalRate)`), `payments[0].montoIgtf === 0` regardless of
     `payment.igtfAmount`, `giftCard.amount === consumedUSD`.
  2. Full gift card (`method.id === -999`, `giftCard.state === 'available'`) → `payments: []`
     (regression, byte-identical to today).
  3. Normal single-method payment (no gift card in context) → payload unchanged from current
     behavior (regression).
  4. Payload never contains more than the 2 tender legs described in Scenario 4 (i.e., no
     accidental 3rd leg).
- **Result**: Added 4 tests to `saleOrderPayload.test.ts` (new describe block "partial gift card
  remainder (2-leg)"). Confirmed RED for the actual new-behavior assertion (`payments[0].amount`
  expected `36` (remainderBs), got `119.48` (old full paymentAmount) — correct failure reason);
  the 3 regression-shaped tests in that same block passed immediately since they exercise
  currently-unchanged paths (full gift card / no gift card), as expected for regression guards.
  11/12 pre-existing + new passed, 1 failed for the right reason before GREEN.

### T1.4 [S] GREEN: buildSaleOrderPayload — implement partial branch
- **File**: `shared/lib/saleOrderPayload.ts` (around l.37, l.91 per design)
- **Depends on**: T1.3 (must be red first)
- **Satisfies**: Scenario 1, Scenario 4, design Interfaces/Contracts code block
- Introduce `isFullGiftCard` / `isPartialRemainder` discriminators exactly as specified in
  design.md's before/after code block. Force `montoIgtf = 0` when `isPartialRemainder` — do
  NOT filter which methods are eligible for the remainder (settled decision, do not reopen).
- Run `npm test` until green.
- **Result — DONE (2026-07-23)**: `shared/lib/saleOrderPayload.ts` updated: renamed
  `isPayingWithGiftCard` → `isFullGiftCard`, added `isPartialRemainder`, `consumedUSD`,
  `remainderBs` exactly as design's before/after block specifies. `payments[0].amount` and
  `.montoIgtf` are now conditioned on `isPartialRemainder` (remainder + forced 0 IGTF) vs. the
  untouched full/normal path. `formattedGiftCard.amount` needed no change (already passes
  `giftCard.amount` through verbatim, which the hook sets to `consumedUSD` per design note).
  `npm test` on `saleOrderPayload.test.ts`: 12/12 green.

### T1.5 [P] Cosmetic: enlarge company logo — DONE (2026-07-23)
- **File**: `cart/components/AppStepper.module.css`
- **Satisfies**: In-scope cosmetic item (not spec-gated, no test required)
- Bump `.companyLogo` height from 88px to ~120px and increase `max-width` proportionally.
- Fully independent of all other tasks in this file — safe to do anytime, including first.
- **Result**: `.companyLogo` height 88px → 120px, `max-width` 140px → 190px (proportional
  increase, same ratio ~1.36x as the height bump). No test required per task spec; visually
  cosmetic only, `width: auto` / `object-fit: contain` untouched so aspect ratio is preserved.

---

## Phase 2 — Depends on Phase 1 (parallel among themselves once T1.2 / T0.1 land)

### T2.1 [P] RED: buildFacturaPayload — failing tests for splitTender — DONE (2026-07-23)
- **File**: `shared/lib/printPayload.test.ts`
- **Depends on**: T0.1 (confirmed tender code)
- **Satisfies**: Scenario 5, design Testing Strategy row 2, design Interfaces/Contracts
  "printPayload.ts — extend buildFacturaPayload"
- **Result**: Added describe block "buildFacturaPayload — splitTender (gift card partial
  remainder, 2-leg print)" with the 3 specified assertions, PLUS a new describe block
  "computeGiftCardSplitTender — wires the print call site for the 2-leg partial remainder"
  (3 tests) for a new pure helper introduced during GREEN (see T2.2 result). Confirmed RED:
  `splitTender` param and `computeGiftCardSplitTender` did not exist yet — 6/6 new tests
  failed for the right reason (`undefined`/`TypeError: ... is not a function`), 13 pre-existing
  passed unaffected.

### T2.2 [S] GREEN: buildFacturaPayload — implement splitTender param — DONE (2026-07-23)
- **Follow-up fix (2026-07-23, verify-report WARNING #1)**: `montoigtf` was computed via
  `calcIgtf(method, totalAmount)` unconditionally, so a remainder method with `applyIgtf: true`
  would print nonzero IGTF while `saleOrderPayload.ts` sends `montoIgtf: 0` to Odoo for the same
  leg — a real payload/print fiscal inconsistency, contradicting design.md's "authoritative,
  forces montoIgtf = 0" decision. Fixed via strict TDD: added RED test in `printPayload.test.ts`
  ("forces montoigtf to 0 on the remainder leg even when the second method applies IGTF"),
  confirmed failure (`montoigtf` was `'108'` instead of `'0'`), then changed
  `buildFacturaPayload` to `const igtfAmount = splitTender ? 0 : calcIgtf(method, totalAmount)`.
  Full suite green after fix: 355/355 tests, typecheck clean. WARNING #1 resolved.
- **File**: `shared/lib/printPayload.ts`
- **Depends on**: T2.1 (red) and T0.1 (confirmed code)
- **Satisfies**: Scenario 5, design Interfaces/Contracts code block
- Added optional 7th param `splitTender: { code: string; amountBs: number } | null = null`
  (after `stationLabel`, matching design's signature intent). When set, adds
  `payload['pago' + splitTender.code.slice(0,2)] = fixNumberForAPI(splitTender.amountBs)`
  without touching the existing single-tender line. `splitTender = null` (default) is
  byte-identical to before (regression-tested).
- **Deviation from design (documented, not silent)**: extracted the "wire the partial print
  call site" logic (design's formula: `consumedBs = giftCard.amount * globalRate`,
  `remainderBs = totalAmountBs - consumedBs`) into a new exported pure function
  `computeGiftCardSplitTender(totalAmountBs, globalRate, giftCard, method)` in
  `printPayload.ts`, instead of inlining it directly at the call site inside
  `saleMachine.ts`'s `printFiscalInvoice` actor. Rationale: the actor's real implementation is
  never exercised by any pre-existing machine-level test (every test that reaches `printing`
  overrides `printFiscalInvoice` via `.provide()` with a fixture) — testing bolívar math
  through the full actor+mocked-printer stack would be indirect and brittle. A pure,
  independently unit-tested helper matches the project's existing pattern (`buildSaleOrderPayload`,
  `buildFacturaPayload` are already pure builders in `shared/lib`) and keeps `saleMachine.ts`'s
  actor thin. `GIFT_CARD_TENDER_CODE = '15'` (from T0.1) lives in `printPayload.ts` next to the
  helper.
- Wired the real call site in `machines/saleMachine.ts`'s `printFiscalInvoice`: computes
  `globalRate` from `useExchangeRateStore.getState().rate || 1` (newly imported), calls
  `computeGiftCardSplitTender(totalAmountBs, globalRate, giftCard, method)`, and passes the
  resulting `{ totalAmount, splitTender }` into `buildFacturaPayload(..., totalAmount,
  'Autopago', splitTender)`. Full gift card (-999) and normal/no-gift-card paths are
  byte-identical (`splitTender: null`, `totalAmount` unchanged) — verified by regression tests.
- **Gotcha found and fixed while adding integration coverage**: the existing
  `FiscalPrinterAdapter` mock in `saleMachine.test.ts` used an ARROW function as
  `mockImplementation`, which is not constructible (`new FiscalPrinterAdapter()` throws
  `"... is not a constructor"`). This bug was LATENT — every pre-existing test overrides
  `printFiscalInvoice` entirely, so `new FiscalPrinterAdapter()` was never actually invoked
  before. Fixed by switching the mock to a regular `function` expression assigning
  `this.printFactura`. No production code was affected; this is a test-infra-only fix,
  necessary to add real coverage of the new wiring.
- `npm test` on `printPayload.test.ts`: 19/19 green. `npm test` on `saleMachine.test.ts`:
  24/24 green (18 pre-existing + 5 T1.1 + 1 new print-wiring integration test).

### T2.3 [P] RED: useGiftCardPayment — failing tests for consumed/remaining math + dispatch — DONE (2026-07-23)
- **File**: `hooks/useGiftCardPayment.test.ts` (new file — none existed before)
- **Depends on**: T1.2 (GIFT_CARD_PARTIAL event must exist to dispatch against)
- **Satisfies**: Scenario 2, Scenario 3 (regression), Scenario 7, design Testing Strategy row 3
- **Result**: Created the test file (RTL `renderHook`, no `QueryClientProvider` needed — this
  hook doesn't use react-query). Added 5 tests covering all 5 specified assertions. Confirmed
  RED: 3/5 failed for the right reason (`consumedAmountUSD`/`remainingBs` not exposed by the
  hook yet; existing hard block still fired the insufficient-balance toast for the partial
  case `0 < balance < total`, blocking the `GIFT_CARD_PARTIAL` dispatch). 2/5 passed immediately
  as expected regression guards (full-balance dispatch shape, zero-balance hard block —
  these exercise currently-unchanged code paths). One test-design correction made mid-RED: the
  `method` fixture passed to the hook must be the gift-card method itself (`id: -999`), matching
  the hook's real calling contract (`GiftCardPaymentView` only mounts this hook for that
  method) — using an arbitrary method id there would not reproduce the real full-vs-partial
  discrimination.

### T2.4 [S] GREEN: useGiftCardPayment — implement partial dispatch, remove hard block — DONE (2026-07-23)
- **File**: `hooks/useGiftCardPayment.ts`
- **Depends on**: T2.3 (red), T1.2
- **Satisfies**: Scenario 2, Scenario 3, Scenario 7, design File Changes row 2
- Added `consumedAmountUSD = foundCard ? Math.min(foundCard.balance, orderTotalUSD) : 0` and
  `remainingBs = foundCard ? total - consumedAmountUSD * globalRate : 0`, exposed both from the
  hook's return object (needed by Phase 3's `GiftCardPaymentView` consumed/remaining UI rows,
  Scenario 7 — not itself required by T2.3/T2.4's literal test list, but a natural, minimal
  extension since Scenario 7 has nothing else to read these values from).
- Replaced the old hard block (`if (foundCard.balance < giftCardAmountUSD) { ...error...
  return }`) with `if (foundCard.balance <= 0) { ...same error...; return }` — hard block now
  fires ONLY for exhausted/zero balance (Scenario 3), never for `0 < balance < total`.
- `handleGiftCardSubmit` now branches: `foundCard.balance >= orderTotalUSD` → full dispatch
  (`SUBMIT_PAYMENT`, unchanged shape, `navigate('/resultado')`); otherwise → partial dispatch
  (`GIFT_CARD_PARTIAL` with `giftCard.amount = consumedAmountUSD`, `remainingAmount =
  remainingBs`, `navigate('/pago')`, confirmed to route to `PaymentSelect` per `router.tsx:40`).
  `hasSufficientBalance` left untouched (still `balance >= total`) — `GiftCardPaymentView`
  (Phase 3, not yet touched) still gates its confirm button on it, so the partial flow is only
  reachable today via direct hook calls (tests) until T3.1 wires the UI; this is the expected,
  documented interim state per the tasks.md dependency graph (T3.1 depends on T2.4, not the
  other way around).
- `npm test` on `useGiftCardPayment.test.ts`: 5/5 green.

---

## Phase 3 — UI wiring (parallel among themselves once Phase 1 + Phase 2 land)

### T3.1 [P] RED+GREEN: GiftCardPaymentView — consumed/remaining UI — DONE (2026-07-23)
- **File**: `components/GiftCardPaymentView.tsx` (+ its test file)
- **Depends on**: T2.4 (hook), T1.2 (machine context)
- **Satisfies**: Scenario 7, design File Changes row 3
- RED: write/extend a component test asserting the view renders "Saldo de la tarjeta", "Monto
  a consumir" (`consumedAmount`), "Monto restante" (`remainingAmount`), and a "Continuar a
  elegir método" button that is enabled (not the old disabled/insufficient-balance warning)
  when `0 < balance < total`.
- GREEN: replace the disabled/insufficient warning markup with the three labeled rows + button,
  wired to `useGiftCardPayment`'s new partial dispatch (T2.4).
- Also assert Scenario 3 regression: when `balance === 0`/invalid, the original
  error/disabled markup still renders.
- **Result**: New file `components/GiftCardPaymentView.test.tsx` (none existed before), 3 tests
  covering Scenario 2 (partial), Scenario 1 (full, regression) and Scenario 3 (zero/invalid,
  regression). Confirmed RED: the Scenario 2 test failed because "Monto restante" was absent,
  the button still read "Confirmar consumo" and was disabled (old `!hasSufficientBalance` gate
  covered BOTH zero-balance and partial cases identically) — correct failure reason; the
  Scenario 1/3 tests passed immediately as expected regression guards (paths not yet touched).
  GREEN: added `consumedAmountUSD`/`remainingBs` props (fed from the hook via `PaymentForm.tsx`,
  see below); split the old single `!hasSufficientBalance` gate into `isZeroBalance =
  foundCard.balance <= 0` (Scenario 3, unchanged disabled/warning markup) vs. `isPartial =
  !hasSufficientBalance && !isZeroBalance` (Scenario 2, NEW — renders "Monto restante" row +
  enables the submit button, now labeled "Continuar a elegir método"). "Monto a consumir" now
  reads `consumedAmountUSD` instead of the old `orderTotalUSD` — byte-identical for the full
  case since `consumedAmountUSD === orderTotalUSD` when `balance >= total` (hook's own
  `Math.min`), so Scenario 1 stays a true regression. `npm test` on
  `GiftCardPaymentView.test.tsx`: 3/3 green.
- **`PaymentForm.tsx` wiring** (needed to satisfy T3.1's new props, not a separate task):
  passes `giftCard.consumedAmountUSD` / `giftCard.remainingBs` (already exposed by the hook
  since T2.4) into `<GiftCardPaymentView>`.

### T3.2 [P] RED+GREEN: PaymentForm — effective total from remainder — DONE (2026-07-23)
- **File**: `pages/PaymentForm.tsx` (+ test)
- **Depends on**: T1.2 (machine context field `remainingAmount`)
- **Satisfies**: Scenario 2 (second method covers `remainingAmount`), design File Changes row 4
- RED: test asserting `usePaymentAmounts`/`detailsForm` receive
  `context.remainingAmount ?? total` as the effective total when `remainingAmount` is set, and
  the untouched `total` otherwise (regression).
- GREEN: implement `effectiveTotal = context.remainingAmount ?? total` and feed it through.
- **Result**: Extended `pages/PaymentForm.test.tsx` — converted the file's `SaleMachineContext`
  mock to a mutable `mockContext` (was a static object referencing a single fixed `method`) so
  each describe block can set its own `context` shape without breaking the pre-existing
  currency-conversion test. Added a new describe block with 2 tests: (1) with
  `context.remainingAmount = 36` and a local (Bs, no IGTF) second-leg method, asserts
  `send`'s `payment.amount === 36` (the remainder), NOT `232` (the full cart total); (2)
  regression — same setup without `remainingAmount` still dispatches `232`. Confirmed RED for
  test (1): got `232` (full cart total), expected `36` — correct failure reason (PaymentForm
  hadn't wired `remainingAmount` yet). Test (2) passed immediately as the expected regression
  guard. GREEN: added `const effectiveTotal = context.remainingAmount ?? total` in
  `PaymentForm.tsx`, fed it into `usePaymentAmounts(method, effectiveTotal, globalRate)`
  (replacing the raw `total`) and into `<PaymentAmountSummary total={effectiveTotal} .../>` (so
  the on-screen "Subtotal" row stays consistent with "Total a pagar", both derived from the
  same effective base). `usePaymentDetailsForm` needed NO change — it already only reads
  `amounts.paymentAmount`/`amounts.paymentIgtf`, both now correctly derived from
  `effectiveTotal`. The `GiftCardPaymentView` branch (method.id === -999, always the FIRST
  leg) intentionally keeps using the raw `total`/`orderTotalUSD` — `remainingAmount` cannot yet
  be set when the gift-card method itself is being selected, and T3.3 guarantees gift card can
  never be re-selected as the second leg. `npm test` on `PaymentForm.test.tsx`: 3/3 green
  (1 pre-existing + 2 new).

### T3.3 [P] RED+GREEN: PaymentSelect — hide gift-card option on second leg — DONE (2026-07-23)
- **File**: `pages/PaymentSelect.tsx` (+ test)
- **Depends on**: T1.2 (machine context field `giftCardLeg`)
- **Satisfies**: Scenario 4 (no more than 2 legs — user cannot pick gift card again),
  design File Changes row 5
- RED: test asserting the gift-card method option is absent from the method list when
  `context.giftCardLeg` is set, and present otherwise (regression).
- GREEN: filter/hide the option accordingly.
- **Result**: New file `pages/PaymentSelect.test.tsx` (none existed before) — 2 tests: gift-card
  option present when `context.giftCardLeg` is unset (regression guard) and absent when set.
  Confirmed RED: the "absent when set" test failed because `PaymentSelect` never destructured
  `context` from `useSaleMachine()` (only `send`), so the option always rendered per
  `useGiftCard && !isGiftCardOrder` alone — correct failure reason. GREEN: destructured
  `context` too and changed the gate to `showGiftCardOption = useGiftCard && !isGiftCardOrder
  && !context.giftCardLeg`. `npm test` on `PaymentSelect.test.tsx`: 2/2 green.

---

## Phase 4 — Integration / manual validation (sequential, last)

### T4.1 [S] Offline replay integration check — DONE (2026-07-23)
- **Depends on**: T1.2 (enqueuingOffline bug fix), T1.4, T2.2
- **Satisfies**: Scenario 6
- Manually or via integration test, enqueue a 2-leg order while offline, replay it, and confirm
  the replayed payload is submitted verbatim (same `payments[]` leg, same `giftCard.amount`)
  and that the v19 backend residual-fill (`pay_with_gift_card`) reconciles it identically to an
  online 2-leg submission. This closes the `enqueuingOffline` bug (engram #423) end-to-end.
- **Result — coverage gap found and closed**: the existing T1.1 test ("enqueuingOffline actor
  input carries giftCardLeg ?? giftCard") only asserted the RAW input object handed to a
  capturing STUB actor — it never exercised the real `enqueueOfflineOrder` implementation
  (i.e., never called the real `buildSaleOrderPayload` with that input), so the actual
  PERSISTED payload shape for the 2-leg partial case was untested end-to-end. Added a new
  integration test to `machines/saleMachine.test.ts` ("T4.1 offline replay integration...") that
  drives the full flow — `GIFT_CARD_PARTIAL` → `SELECT_METHOD` → `SUBMIT_PAYMENT` with
  `submitPaymentToOdoo` forced to a transient error (routes to `enqueuingOffline`) — WITHOUT
  overriding `enqueueOfflineOrder` (real actor, real `buildSaleOrderPayload` call), and asserts
  on what actually reaches the mocked `orderQueue.enqueue(id, payload)`: `payments` has exactly
  1 entry, `payments[0].amount === 38` (remainderBs: totalBs 58 − consumedBs 20 for a 0.5 USD
  gift-card leg at rate 40, same formula T1.3/T1.4 already unit-test in isolation),
  `payments[0].montoIgtf === 0`, and `giftCard` equals the consumed leg
  (`{ amount: 0.5, balance: 0.5, state: 'available', ... }`). Test passed GREEN on first run (no
  implementation change needed — Phase 1's fix (`giftCardLeg ?? giftCard` wired into
  `enqueuingOffline`'s input) already produces the correct payload; this test closes the
  coverage gap, it does not reveal a new bug).
  Verbatim-replay-on-drain is separately, structurally guaranteed and already covered generically
  by `syncManager.test.ts` ("resends the exact stored payload object verbatim (no rebuild)") —
  `syncManager.drain()` treats `target.payload` as opaque `unknown` and forwards it as-is to
  `createSaleOrder`, so once the ENQUEUED payload is correct (proven above), the REPLAYED payload
  is correct by construction (no separate reconstruction path exists to drift).
  `npm test` on `saleMachine.test.ts`: 25/25 green (24 pre-existing + 1 new).

### T4.2 [S] Hardware validation of split-tender fiscal print — PENDING (requires physical fiscal printer hardware — NOT done, cannot be done in this environment)
- **Depends on**: T0.1, T2.2
- **Satisfies**: Scenario 5, design Migration/Rollout note (flagged as pre-release gate)
- On real printer hardware (not just unit tests), confirm the split-tender invoice
  (`pago<confirmed-code>` + `pago01`) prints two distinct tender lines summing to the order
  total. This is a release gate, not optional — do not ship without it per design.md.
- **Why still pending**: this requires a physical ESC/POS fiscal printer reachable via the local
  `printer-agent` bridge (`ServWebImpresion` protocol) — no such hardware exists in this
  development/CI environment. Everything on the code side is done and unit-tested
  (`printPayload.test.ts` 19/19 green, `computeGiftCardSplitTender`, `buildFacturaPayload`
  `splitTender` param) but a fiscal printer's firmware behavior for an UNDOCUMENTED vendor
  tender code (`pago15`) can only be confirmed by actually printing on the device — this was
  flagged as a hard release gate since T0.1 and design.md's Open Questions, not a new risk.
- **What a human must verify on real hardware before closing this release gate**:
  1. Configure a real kiosk station pointed at an actual fiscal printer (not the mocked
     `FiscalPrinterAdapter`) via `printer-agent`.
  2. Run a real 2-leg partial gift-card sale end-to-end: consume part of a gift card balance,
     then pay the remainder with a second method (e.g. cash or pago móvil).
  3. Physically inspect the printed fiscal invoice and confirm it shows TWO distinct tender
     lines — one for the gift-card leg (`pago15`) and one for the remainder (`pago01`) — and
     that their printed amounts sum exactly to the order total (no missing/duplicated/garbled
     line).
  4. Confirm the printer does NOT silently collapse both `pago` fields into a single line, drop
     one of them, or misinterpret `pago15` as something other than "gift card" per the vendor's
     internal `ServWebImpresion` tender table (this table is not documented in any accessible
     repo — see T0.1's residual-uncertainty note).
  5. Only after this physical confirmation should the release be considered unblocked for
     production. If the printer does NOT split correctly, the code-level fix is confined to the
     tender code constant `GIFT_CARD_TENDER_CODE = '15'` in `shared/lib/printPayload.ts` (T0.1's
     documented escape hatch) — swap it for whatever code the vendor confirms, no other code
     needs to change.

### T4.3 [S] Full regression pass — DONE (2026-07-23)
- **Depends on**: all prior tasks
- Run the full `npm test` suite plus manual smoke of Scenario 1 (full balance) and Scenario 3
  (zero/invalid balance) to confirm zero behavioral drift for the two unchanged paths.
- **Result**: `npm test` (full repo, not just touched files): **42 test files, 354 tests, ALL
  GREEN** (353 baseline from Phase 0-3 + 1 new T4.1 integration test; zero regressions,
  zero failures). `npm run typecheck` (`tsc --noEmit`, full repo): **clean, zero type errors**.
  No manual UI smoke was performed (this environment has no browser/kiosk runtime to click
  through Scenario 1/3 by hand) — as a documented substitute, the automated component-level
  regression guards for exactly those two scenarios were re-confirmed green in this same run:
  `GiftCardPaymentView.test.tsx` (Scenario 1 full-balance regression, Scenario 3 zero-balance
  regression), `useGiftCardPayment.test.ts` (full-balance dispatch shape, zero-balance hard
  block), and `saleOrderPayload.test.ts` / `printPayload.test.ts` (full gift card → `payments:
  []`, byte-identical). A human should still do one real click-through smoke pass in a live
  kiosk browser before production sign-off, as normal pre-release practice — this is a
  recommendation, not a blocker, since it is not gated on hardware like T4.2.

---

## Task-to-Scenario Traceability

| Scenario | Tasks |
|---|---|
| 1 (full balance regression) | T1.3/T1.4, T2.3/T2.4, T4.3 |
| 2 (partial balance) | T1.1/T1.2, T2.3/T2.4, T3.1, T3.2 |
| 3 (zero/invalid, regression) | T2.3/T2.4, T3.1, T4.3 |
| 4 (multi-leg payload) | T1.1/T1.2, T1.3/T1.4 |
| 5 (fiscal print) | T0.1, T2.1/T2.2, T4.2 |
| 6 (offline replay) | T1.1/T1.2, T4.1 |
| 7 (UI consumed/remaining) | T2.3/T2.4, T3.1 |
| 8 (payment-flow modified) | T2.3/T2.4 (removes hard block) |
| Cosmetic (logo) | T1.5 |

---

## Review Workload Forecast

**Files touched**: 8 production files (`saleMachine.ts`, `useGiftCardPayment.ts`,
`GiftCardPaymentView.tsx`, `PaymentForm.tsx`, `PaymentSelect.tsx`, `saleOrderPayload.ts`,
`printPayload.ts`, `AppStepper.module.css`) + up to 6 new/extended test files (strict TDD
doubles the surface: every RED task adds a test file or block before its GREEN counterpart).

**Estimated changed lines** (impl + tests, rough order of magnitude):
- `saleMachine.ts` + test: ~50 impl + ~120 test ≈ 170
- `useGiftCardPayment.ts` + test: ~40 impl + ~90 test ≈ 130
- `GiftCardPaymentView.tsx` + test: ~60 impl + ~70 test ≈ 130
- `saleOrderPayload.ts` + test: ~30 impl + ~80 test ≈ 110
- `printPayload.ts` + test: ~20 impl + ~60 test ≈ 80
- `PaymentForm.tsx` + test: ~15 impl + ~30 test ≈ 45
- `PaymentSelect.tsx` + test: ~15 impl + ~30 test ≈ 45
- `AppStepper.module.css`: ~5

**Total estimate: ~715 changed lines**, well above the 400-line single-PR review budget.

- **400-line budget risk**: High (estimate ~1.8x budget).
- **Chained PRs recommended**: Yes. Suggested slices, each independently reviewable and
  shippable, following the phase boundaries above:
  1. PR1 — Phase 1: `saleMachine.ts` (T1.1/T1.2) + cosmetic logo (T1.5). ~175 lines.
     `saleMachine` is foundational and has the highest regression risk (touches
     `enqueuingOffline`, an existing bug) — isolate it for focused review.
  2. PR2 — Pure builders: `saleOrderPayload.ts` (T1.3/T1.4) + `printPayload.ts`
     (T2.1/T2.2, gated on T0.1). ~190 lines. No React, easiest to review in isolation.
  3. PR3 — Hook: `useGiftCardPayment.ts` (T2.3/T2.4). ~130 lines. Depends on PR1 merged
     (needs `GIFT_CARD_PARTIAL` event).
  4. PR4 — UI wiring: `GiftCardPaymentView.tsx`, `PaymentForm.tsx`, `PaymentSelect.tsx`
     (T3.1-T3.3) + integration/hardware validation (T4.1-T4.3). ~220 lines. Depends on
     PR1-PR3 merged.
- **Decision needed before apply**: Yes — per `ask-on-risk` delivery strategy, confirm with
  the user whether to proceed as 4 chained PRs (recommended) or request a maintainer-approved
  `size:exception` for a single PR before `sdd-apply` begins implementation.

---

## Parallelization Summary
- **Phase 0**: sequential, blocking (T0.1).
- **Phase 1**: T1.1→T1.2 and T1.3→T1.4 are independent pairs, run in parallel with each other
  and with T1.5 (fully independent cosmetic task).
- **Phase 2**: T2.1→T2.2 (needs T0.1) and T2.3→T2.4 (needs T1.2) run in parallel with each
  other.
- **Phase 3**: T3.1, T3.2, T3.3 touch disjoint files and can run in parallel once their
  respective Phase 1/2 dependencies are merged.
- **Phase 4**: strictly sequential, last, gates release.
