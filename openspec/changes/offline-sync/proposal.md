# Proposal: Offline-First Synchronizer for the Kiosk

## Intent

The kiosk cannot browse catalog or complete sales when Odoo is unreachable — any single failed RPC flips a global `isOffline` flag and the OfflineOverlay blocks the entire UI. We want the kiosk to keep selling while offline (payment already runs on an independent VPOS server; only Odoo order registration needs deferral) and reconcile automatically on reconnect. Success = a cashier completes and prints a sale offline, and the order reaches Odoo exactly once when connectivity returns.

## Scope

### In Scope
- Persistent product cache in IndexedDB (REPLACE-on-refresh, 5000 ceiling).
- Offline sale-order queue in IndexedDB (max 5 pending), keyed by existing `saleAttemptId`/`x_fex_id`.
- Cache payment methods offline (hard blocker for offline checkout).
- New derived `useShouldBlockUI()` selector: overlay blocks ONLY when offline AND queue full.
- `processing` state 3rd outcome: enqueue-and-print when offline with room.
- Reconnection synchronizer: drains queue in order, one at a time, with backoff.

### Out of Scope
- Card/VPOS integration (already external; not built here).
- Live stock validation (no stock field exists even online today).
- Accumulating catalog across sessions/branches (see Decision 1).
- Migrating `secureStorage.ts` to the new IndexedDB layer.

## Capabilities

### New Capabilities
- `offline-catalog-cache`: IndexedDB product + payment-method cache, replace-on-refresh, 5000 ceiling.
- `offline-order-queue`: bounded FIFO queue of deferred sale orders with idempotency key.
- `offline-sync`: reconnection detection + ordered, backed-off queue drain.

### Modified Capabilities
- None (no existing `openspec/specs/`).

## Approach

Add the `idb` dependency; hand-roll product-cache and order-queue stores on top of it (exploration Approach 2). Reuse the stable `saleAttemptId`/`x_fex_id` as queue key — the drain resends the EXACT SAME payload so Odoo dedupes. Printing does not depend on `odooOrderId`, so offline sales still print; `persistPrinterData` re-runs after the queued order lands. UI copy ("se sincronizará cuando el servidor esté disponible") deferred to sdd-design.

### Key Decisions (orchestrator — user may veto)
- **Decision 1 — "5000 products" = defensive ceiling on replace-on-refresh**, NOT a cross-session accumulator (server caps fetch at 200).
- **Decision 2 — payment methods cached offline** (exploration found `fetchPaymentMethods` blocks offline checkout).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/shared/lib/` | New | `idbStore`, `offlineCache`, `orderQueue`, `syncManager` |
| `src/features/payment/machines/saleMachine.ts` | Modified | 3rd `processing` outcome |
| `src/shared/stores/config.ts` | Modified | derived `useShouldBlockUI()`; keep raw `isOffline` |
| `src/shared/lib/odooEnv.ts` | Modified | reconnection detection hook |
| `src/features/catalog/hooks/useProducts.ts` | Modified | read-through IndexedDB cache |
| `OfflineOverlay.tsx` / `RootLayout.tsx` | Modified | new block condition |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Duplicate submission on drain | Med | Resend identical `x_fex_id` payload; VERIFY backend dedup in eu_agroo_fex_integration_v19 |
| Stock drift while offline | Med | No online stock check exists; document policy; backend must tolerate |
| Storage quota exceeded | Low | Handle `QuotaExceededError` defensively |
| No "back online" event | High | Synchronizer owns backoff/ping detection |
| `x_fex_id` dedup unverified | High | Confirm before apply |

## Rollback Plan

All new stores are additive modules; feature gates on the derived selector and the `processing` 3rd branch. Revert = restore raw `isOffline` overlay condition and remove new `src/shared/lib/` modules + `idb` dep. IndexedDB data is orthogonal and can be cleared.

## Dependencies

- New npm dep: `idb`.
- Backend `x_fex_id` idempotency dedup (must be verified, not assumed).

## Delivery Considerations

Strict TDD is active (`npm test`, Vitest). Co-locate tests; follow the `saleMachine.test.ts` fake-actor pattern and the `cardTerminal.contract.test.ts` contract-test precedent (use `fake-indexeddb`). Likely exceeds the 400-line review budget — flag chained PRs at sdd-tasks (cache / queue / sync / UI slices).

## Success Criteria

- [ ] Cashier completes and prints a sale while Odoo is unreachable.
- [ ] Queued order reaches Odoo exactly once on reconnect (no duplicate).
- [ ] Overlay blocks ONLY when offline AND queue full.
- [ ] Catalog + payment methods browsable offline from cache.
- [ ] Queue survives kiosk reload/crash.
