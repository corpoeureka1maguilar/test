# Exploration: offline-sync (offline-first product cache + order queue)

## Current State

**1. isOffline lifecycle — src/shared/stores/config.ts**
isOffline is a plain boolean in Zustand useConfigStore (NOT in partialize, so it always resets to false on reload). Set to true in exactly ONE file outside the store: src/shared/lib/odooEnv.ts, inside the low-level #post() method of the JSON-RPC client, on THREE paths: HTTP 5xx, fetch timeout (36s TIMEOUT const), and any other network/fetch error. All via dynamic import (avoids circular import odooEnv<->config). So EVERY failing RPC anywhere in the app flips isOffline=true globally — there is no separate health-check/polling loop; it's a side effect of real traffic failing.
Cleared (isOffline:false) in: saveConfig, clearConfig, reauthenticate() on success (called manually from OfflineOverlay's retry button — no auto background reconnection loop exists today), and the MissingError (station deleted) branch.
Implication: a queue-drain synchronizer needs its OWN "back online" detection (e.g. successful drain attempt, or an explicit ping/reauthenticate loop) — nothing to hook into today besides a successful RPC.

**2. Sale-order creation flow — saleMachine.ts / SaleMachineContext.tsx / PaymentForm.tsx / saleOrderPayload.ts / odooRepository.ts**
Chain: PaymentForm.tsx (cashier types reference/amount manually — NO card-terminal/VPOS network call exists in this repo today, confirmed consistent with prior memory that eu_fex_autopay has no card payment integration) -> sends SUBMIT_PAYMENT -> saleMachine `processing` state invokes submitPaymentToOdoo -> buildSaleOrderPayload -> odooRepository.createSaleOrder -> odooEnv.callMethod('sale.order','action_create_sale_order_from_pos',[payload]).
Key facts:
- enteringDetails.entry:'ensureSaleAttemptId' generates a UUID (saleAttemptId = x_fex_id payload.id) ONCE per sale attempt, kept stable across RETRY. This is the existing idempotency key — directly reusable for the offline queue (queue drain retries must resend the SAME payload/id so Odoo dedupes instead of creating duplicates; must verify server-side dedup is actually implemented in eu_agroo_fex_integration_v19/eu_fex_integration, not assumed).
- processing onDone -> setOdooOrderId + transitions to printing. onError -> paymentError (dead end today: no queue, no retry-to-queue).
- CRITICAL FINDING: printFiscalInvoice's input builder does NOT use odooOrderId at all (only customer/cart/method/payment/printer config). So printing (the fiscal/legal receipt) CAN happen even without a resolved Odoo response — meaning offline queueing does NOT need to block the receipt.
- persistPrinterData (fire-and-forget, runs after printing succeeds) is the ONLY place odooOrderId is used — it writes the fiscal number back onto the sale.order record via setOrderPrinterData. It already no-ops safely if odooOrderId is null (`if (!context.odooOrderId || !result?.code) return`) — so today's code doesn't crash on a null id, but the fiscal number would never reach Odoo for a queued order until the synchronizer re-runs setOrderPrinterData after the queued order is actually created.
- ARCHITECTURAL IMPLICATION FOR DESIGN: `processing` today only has 2 outcomes (Odoo confirmed -> printing; Odoo rejected/unreachable -> paymentError dead end). offline-sync needs a 3RD outcome: "Odoo unreachable but queue has room" -> enqueue + proceed to printing as local pseudo-success; "queue full" -> the actual trigger for OfflineOverlay per change intent (block only when offline AND queue full).

**3. Catalog data flow — useProducts.ts / fetchProducts**
useProducts wraps fetchProducts in TanStack Query: staleTime 5min, refetchInterval 10min, refetchIntervalInBackground true, queryKey ['products', fixedProductIds].
fetchProducts: search_read on product.product (domain sale_ok/active/invoice_policy=order), fields [id,name,default_code,barcode,list_price,taxes_id,categ_id,uom_id], **limit:200** (server cap — well under the requested 5000 cache ceiling, so 5000 is defensive/future-proofing, not reflective of current catalog size). Also fetches exchange rate in parallel with "keep last known good" fallback pattern (does NOT overwrite useExchangeRateStore's rate if the fetch failed) — this is a direct precedent for how the new offline product cache should behave (never overwrite good cached data with a degraded/empty read). Also fetches missing branch-fixed products and batch tax rates.
RootLayout.tsx calls queryClient.invalidateQueries({queryKey:['products']}) on kiosk reset — any new persistence layer must not fight TanStack Query's own invalidate/refetch lifecycle; a query persister integration point is cleaner than scattered manual cache reads/writes.

**4. OfflineOverlay — mount & blocking**
Mounted unconditionally at the bottom of RootLayout.tsx, sibling to <Outlet/>, so it wraps every routed screen as a full-screen blocking overlay whenever `isConfigured && isOffline`. Today ANY single failed RPC anywhere (timeout/5xx/network) immediately blocks the ENTIRE UI, even catalog browsing that could continue on cached data. Overlay has its own manual retry (reauthenticate()) with local isRetrying state, no auto-poll inside the component.

**5. Existing persistence utilities**
- Zustand `persist` middleware used in config.ts (localStorage, partialize excludes secrets); cart.ts likely also uses it (RootLayout comment references cart persisted in localStorage, not yet directly confirmed by reading cart.ts).
- secureStorage.ts: hand-rolled raw IndexedDB (`indexedDB.open('autopay-secure',1)`, single 'keys' object store) — but ONLY stores a non-extractable AES-GCM CryptoKey; actual secret payloads still live in localStorage (encrypted). Provides reusable `openDb`/`idbRequest` promise-wrapping helpers/style precedent.
- NO IndexedDB wrapper library in package.json (no idb, localforage, dexie, @tanstack/query-persist-client, @tanstack/query-sync-storage-persister). This is a genuine decision point for the proposal: hand-roll raw IndexedDB (matches existing style) vs add `idb` (much less boilerplate for LRU eviction / ordered queue cursors) vs add TanStack Query's official persister plugin for the catalog specifically.

**6. Other queries that would break offline / matter for completing a sale**
- fetchExchangeRate: already effectively cached — saleOrderPayload.buildSaleOrderPayload reads the rate from useExchangeRateStore (not the network) at payload-build time, so as long as fetchProducts ran once online, rate is available offline.
- fetchPaymentMethods (x.pos.payment.method.search_read): NO cache/store exists for this today. GAP: if this fails offline, checkout cannot even reach selectingMethod — a customer with a warm product cache would still get stuck picking a payment method. This should be explicitly called out in the proposal as either in-scope (cache alongside products) or an explicit known limitation — the change intent as given doesn't mention it.
- fetchAdvertisements: already has try/catch returning [] on failure — degrades gracefully, no work needed.
- fetchOrder: used by useOrder.ts, only relevant for receipt lookups of ALREADY-created orders; not critical to a NEW offline sale.

**7. Test conventions (strict TDD active per openspec/config.yaml, strict_tdd:true)**
Vitest 4.1.9 + Testing Library + jsdom. Tests co-located next to source (saleMachine.test.ts beside saleMachine.ts, useProducts.test.ts beside useProducts.ts). saleMachine.test.ts shows the established mocking pattern: vi.mock('@/shared/lib/odooRepository',...), inject fake fromPromise actors (resolving/rejecting variants), drive with createActor(saleMachine)+actor.send(...), assert on actor.getSnapshot().value/.context — any new "queued order" outcome in `processing` must follow this same style. A contract test precedent exists: src/features/payment/contracts/cardTerminal.contract.test.ts — same pattern could apply to a queue-drain/synchronizer contract test.

## Affected Areas
- src/shared/stores/config.ts — isOffline semantics/overlay trigger likely needs to change to a derived flag (isOffline && queueFull), not raw isOffline, to avoid regressing other call sites.
- src/shared/lib/odooEnv.ts — 3 existing isOffline=true set-sites are natural detection points.
- src/features/payment/machines/saleMachine.ts (+ saleMachine.test.ts) — processing state needs a 3rd branch (enqueue-and-continue vs reject-when-full).
- src/shared/lib/odooRepository.ts (createSaleOrder) and src/shared/lib/saleOrderPayload.ts — payload already has stable idempotency key (id:attemptId), reuse as-is for queue.
- src/features/catalog/hooks/useProducts.ts + odooRepository.fetchProducts — need IndexedDB-backed cache, capped 5000, refresh-only-while-online.
- src/shared/components/OfflineOverlay.tsx + src/shared/layouts/RootLayout.tsx — overlay visibility condition change.
- New modules needed (none exist today): IndexedDB product cache, IndexedDB offline order queue, a synchronizer (drain-on-reconnect with backoff) — likely under src/shared/lib/ (e.g. idbStore.ts / offlineCache.ts / orderQueue.ts / syncManager.ts), naming TBD in proposal.
- src/shared/lib/secureStorage.ts — reference pattern only (openDb/idbRequest helpers), not modified.

## Approaches
1. **Raw IndexedDB (hand-rolled), mirroring secureStorage.ts** — new generic idbStore.ts helper reused by product cache + order queue.
   - Pros: zero new deps, matches existing convention exactly, small auditable surface.
   - Cons: more boilerplate for cursor-based LRU eviction (5000 cap) and ordered queue drain (5 cap); more to unit test.
   - Effort: Medium
2. **Add `idb` dependency (Jake Archibald's promise wrapper)** for both product cache and order queue; keep TanStack Query cache as-is (read-through from fetchProducts, no query-persister plugin).
   - Pros: far less boilerplate for indexes/cursors needed by eviction & ordered drain; tiny/well-maintained zero-dep library; easy to test with fake-indexeddb in Vitest.
   - Cons: new dependency; slight style inconsistency with secureStorage.ts's raw approach unless also migrated (out of scope).
   - Effort: Medium (lower than #1 for eviction/queue logic)
3. **Mixed**: `@tanstack/query-sync-storage-persister` + `@tanstack/react-query-persist-client` for the product cache (query-level persistence, integrates naturally with existing invalidateQueries lifecycle) + hand-rolled/idb for the order queue (FIFO, per-item status — not a good fit for a generic query persister).
   - Pros: catalog persistence "just works" with TanStack Query's existing lifecycle; queue keeps a purpose-built structure.
   - Cons: two different persistence mechanisms in the codebase; the persister mirrors a single query's result (currently ~200 products) — does NOT by itself satisfy an "accumulate up to 5000 distinct products across sessions/branches" semantic if that's what's intended. This surfaces a genuine open question: does "max 5000 products" mean (a) a defensive ceiling on a single-fetch cache-replace model (~200 today, room to grow), or (b) an accumulator across many browsing sessions/branches? Recommend treating it as (a) unless the user says otherwise, matching "refreshed only while online (existing polling)" wording in the change intent — a straightforward cache-replace-on-refresh model.
   - Effort: Medium-High (extra design reconciliation needed)

## Recommendation
Approach 2 (add `idb` dependency, hand-roll both product-cache and order-queue stores on top of it). Reuse saleOrderPayload's existing attemptId/x_fex_id as the queue item's unique key (no new id scheme). Pull fetchPaymentMethods into scope for caching in the proposal (see Gap in section 6) — otherwise checkout still breaks offline right after the product cache "succeeds." The saleMachine `processing` state needs an explicit design decision on how "enqueued, treated as local success" is represented in context (e.g. queuedOffline:boolean or a sentinel odooOrderId) so success/receipt screens can show "se sincronizará cuando el servidor esté disponible" — decide in sdd-design since it also changes UI copy.

## Risks
- Duplicate order submission on retry: mitigated by existing x_fex_id/attemptId idempotency key IF backend dedup is actually implemented (unverified in this repo — lives in eu_agroo_fex_integration_v19 / eu_fex_integration). Synchronizer must resend the EXACT SAME payload object on retry, not rebuild it.
- Stock drift while offline: product fetch has no stock field today (PRODUCT_FIELDS has none), so live stock-checking doesn't exist even online — offline doesn't materially worsen this, but bulk-committing queued orders later could reveal oversells a live system would've caught one at a time; backend must already tolerate this or proposal needs an explicit policy.
- Queue persistence across reloads: must be IndexedDB-backed (kiosks can reboot/crash); IndexedDB confirmed available/used already in this exact deployment (secureStorage.ts) — low environment risk.
- Storage quota: 5000 products + 5 queued orders is trivial for IndexedDB quotas; still should handle QuotaExceededError defensively (not handled anywhere today).
- isOffline is a shared, side-effect-driven GLOBAL flag set by ANY failing RPC (not just health checks) — changing overlay trigger semantics must not conflate "isOffline" with "queue full" and accidentally suppress legitimate error handling for unrelated RPCs (e.g. fetchAdvertisements failures). Recommend a new derived selector (e.g. useShouldBlockUI()) rather than overloading isOffline itself.
- No existing "back online" event — synchronizer needs its own reconnection detection (backoff loop treating any successful RPC as "online", or a dedicated ping), nothing to hook into today besides reauthenticate() or an unrelated successful query.
- fetchPaymentMethods has no offline story (Gap #6) — if unaddressed, feature only partially unblocks offline sales.

## Ready for Proposal
Yes — but the proposal MUST explicitly resolve two open questions before design: (1) semantics of "max 5000 products" (cache-replace-with-cap vs accumulate-across-sessions), and (2) whether fetchPaymentMethods (and optionally fetchAdvertisements, already resilient) are in-scope for the same caching mechanism, since payment-method availability is a hard blocker for completing a sale offline just like the product catalog is.
