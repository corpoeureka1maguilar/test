# Tasks: Offline-First Synchronizer for the Kiosk

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1500-1850 total (PR1 ~500-600, PR2 ~450-550, PR3 ~400-500, PR4 ~150-200) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (idbStore+offlineCache) -> PR 2 (orderQueue+saleMachine) -> PR 3 (syncManager+drain) -> PR 4 (UI blocking) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending — user decision required |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | `idbStore` + `offlineCache` (products/payment methods), `useProducts` wiring | PR 1 | Adds `idb`/`fake-indexeddb` deps; base for all others; tests co-located |
| 2 | `orderQueue` + `saleMachine.enqueuingOffline` outcome | PR 2 | Depends on PR 1's `idbStore`; may itself need sub-split if >400 lines |
| 3 | `syncManager` + reconnection drain | PR 3 | Depends on PR 2's `orderQueue`; includes contract test |
| 4 | `useShouldBlockUI` + `OfflineOverlay`/`RootLayout` wiring | PR 4 | Depends on PR 2's `offlineQueueStore`; smallest slice |

PR1 and PR2 individually risk exceeding 400 lines on their own; may require further sub-splitting at apply time (e.g., PR1a idbStore / PR1b offlineCache+wiring).

## Phase 0: Dependencies & Test Harness

- [x] 0.1 Add `idb` (runtime dep) and `fake-indexeddb` (devDep) to `package.json`
- [x] 0.2 Register `fake-indexeddb/auto` as a Vitest `setupFiles` entry so IndexedDB tests get a fresh in-memory DB

## Phase 1: Storage Foundation — idbStore + offlineCache (PR 1)

- [x] 1.1 RED: `src/shared/lib/idbStore.test.ts` — open/upgrade creates `catalog`+`orderQueue` stores, capped write, `QuotaExceededError` guard keeps prior data
- [x] 1.2 GREEN: `src/shared/lib/idbStore.ts` — open `autopay-offline` v1, promise/txn helpers, capped write, quota guard
- [x] 1.3 RED: `src/shared/lib/offlineCache.test.ts` — replace caps at 5000; empty fresh does not wipe good cache; failed fetch preserves cache (spec: offline-catalog-cache)
- [x] 1.4 GREEN: `src/shared/lib/offlineCache.ts` — `replaceProducts`/`getProducts`, `replacePaymentMethods`/`getPaymentMethods`, 5000-slice cap
- [x] 1.5 Wire `useProducts.ts` `queryFn` to write-through-then-read-through-fallback (spec: Catalog Served From Cache When Offline, Refresh Only While Online)
- [x] 1.6 RED/GREEN: `useProducts.test.ts` additions — reject+cache present returns cached; no cache throws
- [x] 1.7 Apply same write-through/read-through wiring to the payment-methods query hook
- [x] 1.8 RED/GREEN: payment-methods hook test — offline serves cached methods; never-cached+offline returns empty list, checkout cannot proceed past `selectingMethod`

## Phase 2: Order Queue + Sale Machine (PR 2)

- [x] 2.1 RED: `orderQueue.test.ts` — enqueue to cap 5, reject over cap, FIFO `seq` order, patch fiscal, dequeue, hydrate count, `draining->pending` reset (spec: Bounded FIFO Queue, Idempotency Key Reuse)
- [x] 2.2 GREEN: `src/shared/lib/orderQueue.ts` on `orderQueue` store (keyPath `id`=`x_fex_id`, index `bySeq`)
- [x] 2.3 Create `src/shared/stores/offlineQueue.ts` Zustand store (`count`, `setCount`) as synchronous mirror only
- [x] 2.4 RED: `saleMachine.test.ts` additions — transient error -> `enqueuingOffline` -> `printing` (`queuedOffline:true`, `odooOrderId:null`); `OdooServerError` -> `paymentError`; enqueue rejects (full/quota) -> `paymentError`; `printing.onDone` patches queue fiscal
- [x] 2.5 GREEN: add `isDeferrableError` guard, `enqueuingOffline` state, `enqueueOfflineOrder` invoked actor, `patchQueueFiscal` action to `saleMachine.ts`
- [x] 2.6 Update success-screen copy/context for `queuedOffline` flag ("se sincronizará cuando el servidor esté disponible")

## Phase 3: Synchronizer (PR 3)

- [x] 3.1 RESOLVED (2026-07-06, user decision): design ADR-3 wins — permanent Odoo errors (`OdooServerError`) mark the queue entry `failed` (kept for manual review) and the drain CONTINUES; only transient/network errors stop the drain. `offline-sync` spec's "Partial Drain Failure Handling" requirement updated to match. Drain implementation itself is Phase 3 (batch 2 of apply).
- [x] 3.2 RED: `syncManager.test.ts` — drain removes items in FIFO order; failure handling per 3.1 resolution; resend uses stored payload verbatim
- [x] 3.3 GREEN: `src/shared/lib/syncManager.ts` — `drain()`, backoff (base 5s, factor 2, cap 60s, full jitter), subscribe to `isOffline` true->false, own `pingStation` poll while queue non-empty
- [x] 3.4 RED/GREEN: boot recovery — reset any `status:'draining'` item to `'pending'` on startup, resume drain (spec: App Restart Mid-Drain Recovery)
- [x] 3.5 Add `syncManager.contract.test.ts` (mirrors `cardTerminal.contract.test.ts`) asserting `createSaleOrder` is called with the exact stored payload object (spec: No Duplicate Submissions)
- [x] 3.6 Wire `syncManager` singleton init into app bootstrap (`App.tsx` — `initSyncManager()` on mount, independent of `isConfigured` so boot recovery always runs)

## Phase 4: UI Blocking Rule (PR 4)

- [x] 4.1 RED: `useShouldBlockUI.test.ts` — offline+full->true; offline+not-full->false; online+full->false; not-configured->false (spec: Derived Block Selector)
- [x] 4.2 GREEN: `src/shared/hooks/useShouldBlockUI.ts`
- [x] 4.3 Update `OfflineOverlay.tsx` to guard on `useShouldBlockUI()` instead of raw `isOffline`; copy updated to "Cola de ventas offline llena". `RootLayout.tsx` needed no change — it only renders `<OfflineOverlay />` and had no direct `isOffline` guard of its own.
- [ ] 4.4 Manual/integration check: cashier completes+prints sale offline with queue room; overlay stays hidden until 5/5 (MANUAL — requires physical kiosk/printer, cannot be automated in this apply batch; unit coverage for the same behavior exists in `OfflineOverlay.test.tsx`)

## Phase 5: Cleanup / Verification

- [x] 5.1 VERIFIED PARTIAL (2026-07-06): `eu_pos_base/models/sale_order.py:1240` searches by `x_fex_id` before `create()` (application-level dedup exists), but there is NO unique DB constraint on `x_fex_id`. Race window accepted as low-risk because the kiosk drains the offline queue sequentially, one order at a time (never parallel — see ADR-3). Does not block PR 3, but a DB-level unique constraint remains a recommended backend hardening follow-up outside this change's scope.
- [x] 5.2 Documented offline stock-drift policy (no online stock check exists) + drain failure semantics + x_fex_id dedup hardening note in `docs/offline-sync.md`
- [x] 5.3 Full suite run (`npm test`): 211/211 passing across 29 files. `npm run typecheck`: clean except the pre-existing unrelated `WelcomeAd.tsx:15` TS6133 error (not touched by this change). `state.yaml` updated to close out apply.

## Phase 6: Instance Scoping (Amendment — post-verify)

Reconfiguring a kiosk against a different Odoo server/database/station must never
drain or serve IndexedDB data left behind by a previous instance (see design.md ADR-6).

- [x] 6.1 Add `getInstanceKey()` helper to `src/shared/lib/idbStore.ts` — composes `odooUrl|odooDb|stationId` from `useConfigStore`, returns `null` when `isConfigured` is false. Bump `DB_VERSION` to 2 (comment-documented; no structural store/index change, data-shape addition only).
- [x] 6.2 RED/GREEN: `orderQueue.ts` — tag every `enqueue()`d entry with `instanceKey`; add `matchesInstance(entry, instanceKey)` helper; the `MAX_QUEUE_SIZE` cap check in `enqueue()` counts ONLY entries matching the current instance; `hydrateCount()` mirrors only current-instance pending count into `offlineQueueStore`; `resetDrainingToPending()` only resets current-instance `draining` entries; add `tagLegacyEntries()` to lazily stamp untagged legacy entries with the current instance
- [x] 6.3 RED/GREEN: `syncManager.ts` — `drain()` returns immediately (no-op) when `getInstanceKey()` is `null`; `drain()`'s target lookup filters by `matchesInstance`; `initSyncManager()` calls `tagLegacyEntries()` before `resetDrainingToPending()`, and its initial "drain if pending" check is instance-scoped
- [x] 6.4 RED/GREEN: `offlineCache.ts` — tag catalog rows with `instanceKey` on write; `getCatalog()` returns `[]` when unconfigured or when the stored row's `instanceKey` mismatches the current instance; legacy untagged rows are served once and lazily tagged with the current instance on that first read
- [x] 6.5 Update existing test suites (`orderQueue.test.ts`, `syncManager.test.ts`, `offlineCache.test.ts`) to configure a stable `useConfigStore` instance (`isConfigured:true, odooUrl, odooDb, stationId`) in `beforeEach` so pre-existing scenarios keep passing under instance scoping
- [x] 6.6 Full suite + typecheck re-run; update `state.yaml` and `design.md` (ADR-6). Result: 226/227 tests passing (16 new instance-scoping tests added on top of the prior 211; the 1 failure is `fiscalPrinter.test.ts` — pre-existing, fully unrelated to offline-sync, reproduces identically in isolation with zero offline-sync files touched). `npm run typecheck`: clean except the pre-existing unrelated `WelcomeAd.tsx:15` TS6133 error.
