# Design: Offline-First Synchronizer for the Kiosk

## Executive Summary

Add four additive modules under `src/shared/lib/` on top of the `idb` library — a
generic `idbStore` wrapper, a capped `offlineCache` (products + payment methods),
a bounded FIFO `orderQueue`, and a `syncManager` (reconnection detection + ordered
backed-off drain). IndexedDB is the persistence source of truth; a tiny Zustand
`offlineQueueStore` mirrors the queue count synchronously so XState guards and the
new `useShouldBlockUI()` selector stay side-effect-free. The `saleMachine.processing`
state gains a 3rd outcome via a guarded `onError` that routes transient/network
failures into a new `enqueuingOffline` state (enqueue → print as local success),
while permanent Odoo business rejections still go to `paymentError`. Catalog and
payment-method reads use a write-through / read-through fallback inside the existing
TanStack Query `queryFn` (no persister plugin). Idempotency rides the existing
`saleAttemptId` / `x_fex_id`: the drain resends the EXACT stored payload verbatim.

## Architecture Approach

- **Pattern**: Hexagonal — IndexedDB is an adapter behind small purpose-built
  ports (`offlineCache`, `orderQueue`); `syncManager` is an application-service
  orchestrator; the `saleMachine` remains the domain state owner.
- **Layering**: `idb` (vendor) → `idbStore` (generic promise/txn helper, mirrors the
  `openDb`/`idbRequest` style of `secureStorage.ts`) → `offlineCache` + `orderQueue`
  (domain stores) → `syncManager` + hooks/selectors (application/UI).
- **Boundary rule**: IndexedDB is the ONLY durable store; the Zustand
  `offlineQueueStore` is a *derived synchronous reflection* of the queue, never an
  independent source of truth. Every queue mutation updates both atomically
  (IndexedDB first, then store count).

## Component Map

| Module (new) | Responsibility | Depends on |
|---|---|---|
| `src/shared/lib/idbStore.ts` | Open DB (single versioned schema), promise/txn helpers, capped writes, `QuotaExceededError` guard | `idb` |
| `src/shared/lib/offlineCache.ts` | Write-through/read-through cache for products + payment methods; replace-on-refresh; 5000 ceiling; keep-last-good | `idbStore` |
| `src/shared/lib/orderQueue.ts` | Bounded FIFO (max 5) keyed by `x_fex_id`; enqueue/peek/patch/dequeue/hydrate; updates `offlineQueueStore.count` | `idbStore`, `offlineQueueStore` |
| `src/shared/stores/offlineQueue.ts` | Zustand store: synchronous `count`, `setCount` — mirror only | `zustand` |
| `src/shared/lib/syncManager.ts` | Reconnection detection + ordered, backed-off, idempotent drain; startup recovery of `draining` items | `orderQueue`, `odooRepository`, `config` |
| `src/shared/hooks/useShouldBlockUI.ts` | Derived blocking selector: `isConfigured && isOffline && count >= 5` | `config`, `offlineQueue` |

| Module (modified) | Change |
|---|---|
| `saleMachine.ts` | `processing.onError` guarded → `enqueuingOffline` (new state, invokes `enqueueOfflineOrder`) or `paymentError`; `queuedOffline` context flag; `printing.onDone` patches queue item with fiscal result |
| `config.ts` | No semantic change to `isOffline`; syncManager subscribes to it. Keep raw flag intact |
| `useProducts.ts` (+ payment-methods hook) | `queryFn` wraps repo call with write-through-then-read-through-fallback |
| `OfflineOverlay.tsx` / `RootLayout.tsx` | Overlay reads `useShouldBlockUI()` instead of raw `isOffline` |
| `odooEnv.ts` | No structural change needed; existing 3 `isOffline=true` sites remain the offline signal |

## Data Flow

### Offline sale (happy path while Odoo unreachable)
```
enteringDetails --SUBMIT_PAYMENT--> processing
  invoke submitPaymentToOdoo -> createSaleOrder -> network fails (plain Error)
  onError [guard: isDeferrableError] --> enqueuingOffline
      invoke enqueueOfflineOrder(payload)   // capacity+quota enforced in txn
        onDone  --> printing   (assign queuedOffline:true, odooOrderId:null)
        onError --> paymentError  (queue full OR QuotaExceeded)
printing.onDone -> success
      actions: setPrinterResult, persistPrinterData (no-ops: odooOrderId null),
               patchQueueFiscal (store {code,date,serial} on the queue item)
```

### Reconnect + drain
```
syncManager.drain() [triggered on isOffline:true->false OR backoff poll success]
  for each item in FIFO order (one at a time):
    mark status 'draining'
    createSaleOrder(item.payload)            // EXACT stored payload, verbatim
      -> odooOrderId
    if item.fiscal: setOrderPrinterData(odooOrderId, code, date, serial)
    dequeue(item.id); offlineQueueStore.count--
    on transient error  -> revert to 'pending', STOP, schedule backoff retry
    on permanent error  -> mark 'failed', increment attempts, SKIP to next, toast
```

## Integration Points

- **Idempotency key**: `orderQueue` item `id` = `saleAttemptId` = `payload.id`
  (`x_fex_id`). `ensureSaleAttemptId` already generates it once per attempt. Drain
  resends the stored payload object as-is — NEVER rebuilds it (rebuilding could
  drift the rate or line data and defeat dedup).
- **Reconnection signal**: subscribe to `useConfigStore` `isOffline`; a `true→false`
  transition (from `reauthenticate()` or a successful background refetch that clears
  the flag) triggers `drain()`. Additionally, `syncManager` runs its OWN backoff poll
  (see below) using the existing `pingStation(stationId)` RPC to actively flip
  `isOffline` when no other traffic is generated. `navigator.onLine` / the `online`
  event are used only as cheap *hints* to shorten the next poll — LAN-up ≠ Odoo-up,
  so they are never treated as authoritative.
- **Sync guard input**: XState guards are synchronous, so the enqueue decision cannot
  read IndexedDB. Capacity is enforced authoritatively inside the `enqueueOfflineOrder`
  actor (txn read-count-then-insert, reject if full); the machine simply routes any
  deferrable error into `enqueuingOffline`.

## ADR-style Decisions

### ADR-1 — Storage layer: `idb`
**Decision**: Add the `idb` dependency (proposal Approach 2) and hand-roll
`offlineCache` + `orderQueue` on top of it.
**Rationale**: Cursor-based FIFO drain and capped eviction need index/cursor
plumbing that is verbose in raw IndexedDB. `idb` is a tiny, zero-dep, well-maintained
promise wrapper, trivial to test with `fake-indexeddb`.
**Rejected**:
- *Raw IndexedDB (mirror `secureStorage.ts`)* — zero new deps and stylistically
  consistent, but the cursor/eviction/ordered-drain boilerplate inflates the surface
  to unit-test with no real benefit here.
- *TanStack Query persister plugin* — natural for the catalog, but it mirrors a single
  query result and is a poor fit for a stateful FIFO queue with per-item status; would
  introduce two persistence mechanisms.
- *`localforage`* — larger, older API, still needs hand-rolled queue semantics.

**Schema** — single DB `autopay-offline`, version 1 (separate from `autopay-secure`
to keep concerns isolated and rollback trivial):

```
DB: autopay-offline (v1)
  store 'catalog'          keyPath: 'kind'        // 'products' | 'paymentMethods'
    { kind, items: T[], updatedAt: number }       // one row per kind, replace-on-refresh
  store 'orderQueue'       keyPath: 'id'           // id = x_fex_id
    index 'bySeq' on 'seq' (unique, autoincrement source for FIFO ordering)
    {
      id: string,                 // saleAttemptId / x_fex_id
      seq: number,                // monotonic; FIFO drain order
      payload: object,            // EXACT buildSaleOrderPayload output — resend verbatim
      fiscal: { code, date, serial } | null,  // filled after local print
      status: 'pending' | 'draining' | 'failed',
      attempts: number,
      lastError: string | null,
      enqueuedAt: number
    }
```
Catalog is stored as one row per `kind` (replace whole array on refresh) rather than
one row per product — this makes replace-on-refresh atomic and keeps the "keep last
known good" invariant simple. The 5000 ceiling is a defensive `slice(0, 5000)` cap on
write (Decision 1: ceiling, not accumulator; server caps fetch at 200).

### ADR-2 — Queue hook point in the sale flow
**Decision**: `processing.onError` becomes a guarded transition. Guard
`isDeferrableError(error)` = `!(error instanceof OdooServerError)` (network / timeout /
5xx throw plain `Error`; Odoo business rejections throw `OdooServerError`). Deferrable →
new state `enqueuingOffline` (invokes `enqueueOfflineOrder`, which persists the payload);
on success → `printing` with `queuedOffline: true`, `odooOrderId: null`. Non-deferrable
(permanent business rejection) → `paymentError` unchanged.
**Rationale**: Printing the fiscal receipt does NOT depend on `odooOrderId`
(exploration finding); `persistPrinterData` already no-ops on null id, so the offline
sale prints and completes locally. Making enqueue a dedicated *invoked* state (not an
action) means a failed enqueue (queue full / `QuotaExceededError`) correctly routes to
`paymentError` instead of silently proceeding to print an order that was never queued.
**Two-phase queue write**: the payload is enqueued in `enqueuingOffline` BEFORE printing
(the fiscal number is unknown yet); after `printing.onDone`, `patchQueueFiscal` writes
`{code,date,serial}` onto the queue item so the drain can call `setOrderPrinterData`
post-creation.
**Context additions**: `queuedOffline: boolean` drives the success screen copy
("Se registrará y sincronizará cuando el servidor esté disponible").
**Rejected**: resolving a sentinel inside the actor (`{queuedOffline:true}`) and
branching only in `onDone` — hides the queue-full failure path and couples the actor to
storage concerns; the machine should express the decision.

### ADR-3 — Synchronizer
**Decision**: `syncManager` singleton with a single `drain()` entry, triggered by
(a) a Zustand subscription on `isOffline` `true→false`, and (b) its own exponential
backoff poll using `pingStation(stationId)`.
- **Backoff**: base 5s, factor 2, cap 60s, full jitter; poll runs ONLY while the queue
  is non-empty. Resets to base on any successful drain step. Stops entirely when the
  queue empties.
- **Sequential drain**: one item at a time in `seq` order (FIFO). Never parallel —
  ordering + idempotency correctness over throughput (max 5 items).
- **Idempotency**: resend the stored `payload` verbatim via `createSaleOrder`. Relies
  on backend `x_fex_id` dedup (RISK — see below).
- **Permanent per-item failure** (`OdooServerError` during drain): mark item `failed`,
  keep it (a fiscal receipt was already printed — the order MUST reach Odoo or be
  reconciled manually; silent delete would lose a legally-printed sale), increment
  `attempts`, surface a toast, and SKIP to the next item so one bad order does not wedge
  the queue.
- **Transient failure**: revert item to `pending`, STOP the drain, schedule the next
  backoff attempt.
**Rejected**: relying solely on an opportunistic "any successful RPC" signal — a kiosk
sitting idle offline with a full queue generates no traffic and would never drain;
the dedicated poll guarantees eventual reconnection.

### ADR-4 — Blocking selector
**Decision**: New hook `useShouldBlockUI()` composing two synchronous selector
subscriptions; do NOT repurpose `isOffline`.
```ts
export function useShouldBlockUI() {
  const isConfigured = useConfigStore(s => s.isConfigured)
  const isOffline    = useConfigStore(s => s.isOffline)
  const count        = useOfflineQueueStore(s => s.count)
  return isConfigured && isOffline && count >= MAX_OFFLINE_QUEUE // 5
}
```
`OfflineOverlay` swaps its `!isConfigured || !isOffline` guard for `!useShouldBlockUI()`.
**Rationale**: `isOffline` is a global side-effect flag flipped by ANY failing RPC
(incl. `fetchAdvertisements`); overloading it would suppress legitimate error handling
elsewhere. Each selector returns a primitive → no reference-churn re-renders
(vercel-react rule: selector-based subscriptions). Two separate stores → compose in a
hook rather than cross-store derivation.

### ADR-5 — Cache read-through strategy
**Decision**: Custom `queryFn` write-through + read-through fallback inside the existing
TanStack Query hooks (no persister plugin).
```ts
queryFn: async () => {
  try {
    const fresh = await fetchProducts(ids)
    await offlineCache.replaceProducts(fresh)   // capped 5000, atomic replace
    return fresh
  } catch (err) {
    const cached = await offlineCache.getProducts()
    if (cached.length) return cached            // degrade: query stays "success"
    throw err                                   // truly no data -> real error
  }
}
```
Same shape for the payment-methods hook (Decision 2: payment methods are a hard offline
blocker). Query keys, `staleTime` (5min) and `refetchInterval` (10min) stay unchanged.
**Rationale**: Matches the existing "keep last known good" precedent (exchange-rate
fallback in `fetchProducts`), never fights `invalidateQueries`, adds no deps, and keeps
the offline read invisible to callers (UI never sees an error while cache exists).
**Rejected**: `@tanstack/query-persist-client` — extra deps, mirrors a single query, and
its rehydrate/refetch lifecycle would compete with the kiosk-reset `invalidateQueries`.

### ADR-6 — Instance scoping (amendment, post-verify)

**Decision**: Derive a single `instanceKey = odooUrl + '|' + odooDb + '|' + stationId`
from `useConfigStore` via one helper, `getInstanceKey()` (in `idbStore.ts`, the base
offline lib module every other module already imports from), returning `null` when
`isConfigured` is false. Tag every `orderQueue` entry and every `catalog` row with the
`instanceKey` active at write time. Reads/drains filter by `matchesInstance(entry,
instanceKey)`; the synchronizer and cache reads never touch entries whose
`instanceKey` doesn't match the current one.
**Rationale**: `clearConfig()` intentionally wipes `useConfigStore` (Zustand
`persist`) but NEVER touches the `autopay-offline` IndexedDB database — that DB's
lifecycle is deliberately independent (ADR-1). A kiosk re-`saveConfig()`'d against a
different Odoo server/DB/station therefore boots with a stale-but-present IndexedDB:
without scoping, the new instance would silently drain another business's pending
sale orders into the wrong Odoo (or, at minimum, hand another instance's cached
catalog to a cashier). Composing the key in one place (rather than at each call site)
avoids drift if the composition changes later.
**Foreign entries stay dormant, never deleted**: a queued order is a legal record of
an already-printed fiscal receipt (see Failure Modes below); an entry belonging to
instance A that becomes foreign after a reconfig to instance B must not be sent,
failed, or removed by instance B's synchronizer — only instance A (if reconfigured
back) can resolve it. This mirrors the existing "never delete a `failed` entry"
precedent from ADR-3.
**Migration**: `DB_VERSION` bumped `1 -> 2` (data-shape addition — `instanceKey` is
an optional field on existing stores/indexes, no new object store or index is
needed, so `upgrade()` needs no new branch beyond the existing idempotent
create-if-missing checks). Entries/rows persisted before this amendment have no
`instanceKey`; they are lazily tagged with whichever instance is active the FIRST
time they are read/booted against after the upgrade (`tagLegacyEntries()` for the
queue, called from `initSyncManager()`; inline tag-on-read for catalog rows in
`getCatalog()`). This is safe because every kiosk deployed before this amendment has
only ever had exactly one instance.
**Rejected**:
- *Separate IndexedDB database per instance* — would require dynamically naming
  `autopay-offline-{instanceKey}`, complicating `idbStore.ts`'s singleton
  connection-caching and forcing a close/reopen cycle on every reconfigure; the
  per-record tag is simpler and this queue never exceeds 5 entries anyway.
- *Wipe `autopay-offline` inside `clearConfig()`* — would delete instance A's
  not-yet-drained (already fiscally printed) orders and cached catalog the moment
  someone reconfigures the kiosk, which is exactly the data-loss ADR-3 was written to
  prevent.

## Failure Modes

| Mode | Handling |
|---|---|
| `QuotaExceededError` on catalog write | Catch in `idbStore`; KEEP existing cache (never clear-then-fail), log + toast; catalog stays on last-good data |
| `QuotaExceededError` on enqueue | `enqueueOfflineOrder` rejects → `paymentError`; cashier cannot complete this sale offline (data is tiny; effectively unreachable) |
| Queue full (>=5) | `enqueueOfflineOrder` rejects → `paymentError`; `useShouldBlockUI()` is already true so the overlay blocks new attempts until drained |
| App restart mid-drain | On boot, `syncManager` resets any `status:'draining'` item back to `'pending'` and re-drains; idempotency key makes a possibly-committed resend safe |
| Partial drain failure | Sequential FIFO: items before the failure are already removed; transient stops+backoff, permanent flags+skips (see ADR-3) |
| `isOffline` never clears (idle kiosk) | Own backoff poll actively flips it via `pingStation` |
| Stock drift while offline | No online stock field exists today; documented policy — backend must tolerate bulk-committed queued orders (RISK) |

## Testing Approach (Strict TDD, Vitest)

Add devDeps: `idb` (runtime dep) and `fake-indexeddb` (devDep — NEITHER is in
`package.json` today). Register `fake-indexeddb/auto` via a Vitest `setupFiles` entry
so all IndexedDB-touching tests get a fresh in-memory DB. Co-locate tests
(`orderQueue.test.ts` beside `orderQueue.ts`, etc.), red→green per the project workflow,
and follow the `saleMachine.test.ts` fake-actor pattern.

- `idbStore.test.ts` — open/upgrade, capped write, `QuotaExceededError` guard keeps prior data.
- `offlineCache.test.ts` — replace caps at 5000; `getProducts` returns cached; empty fresh does NOT wipe good cache (keep-last-good).
- `orderQueue.test.ts` — enqueue to cap, reject over cap, FIFO `seq` order, patch fiscal, dequeue, hydrate count into `offlineQueueStore`, `draining→pending` reset.
- `syncManager.test.ts` — drain removes items in order; transient failure stops + schedules backoff; permanent (`OdooServerError`) flags+skips; resend uses stored payload verbatim (assert `createSaleOrder` called with the exact object). Consider a `syncManager.contract.test.ts` mirroring the `cardTerminal.contract.test.ts` precedent for the drain↔repository contract.
- `saleMachine.test.ts` (additions) — transient error → `enqueuingOffline` → `printing` (assert `queuedOffline:true`, `odooOrderId:null`); `OdooServerError` → `paymentError`; enqueue actor rejects (full/quota) → `paymentError`; `printing.onDone` patches queue fiscal. Use injected fake `fromPromise` actors as in the existing suite.
- `useShouldBlockUI.test.ts` — offline+full→true; offline+not-full→false; online+full→false; not-configured→false.
- `useProducts.test.ts` (additions) — network reject with cache present → returns cached (no error); no cache → throws.

## Risks / Open Questions (carry into tasks/apply)

- **Backend `x_fex_id` dedup UNVERIFIED** (High) — must confirm in
  `eu_agroo_fex_integration_v19/eu_autopay(_bridge)` before apply; without it the drain
  can duplicate orders.
- **Offline stock drift** (Med) — no online stock check exists; backend must tolerate
  bulk-committed queued orders; document as accepted policy.
- **`isOffline` clears asynchronously** — the `odooEnv` `isOffline=true` set-site uses a
  dynamic `import().then(setState)` (microtask), so it is NOT reliably set the instant
  `processing.onError` fires. This is why ADR-2 discriminates by error *type*
  (`OdooServerError`) rather than reading the flag in the guard. Verify no code path
  throws a plain `Error` for a *permanent* rejection (would be wrongly queued).
- **Two persistence DBs** — `autopay-secure` (existing) + `autopay-offline` (new); kept
  separate deliberately; not merged (out of scope).
