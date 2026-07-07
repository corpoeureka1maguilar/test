# offline-sync Specification

## Purpose

Detect reconnection and drain the offline order queue safely, and expose a UI-blocking signal that reflects "cannot operate" (offline AND queue full) rather than "any RPC failed."

## Requirements

### Requirement: Derived Block Selector

The system MUST expose a new derived selector, `useShouldBlockUI()`, that returns true only when `isOffline` is true AND the order queue is full (5/5). The raw `isOffline` flag MUST remain unchanged and available for other consumers.

#### Scenario: Offline with room does not block

- GIVEN `isOffline` is true and the queue holds 2 of 5 orders
- WHEN `useShouldBlockUI()` is evaluated
- THEN it returns false and `OfflineOverlay` does not render

#### Scenario: Offline and full blocks

- GIVEN `isOffline` is true and the queue holds 5 of 5 orders
- WHEN `useShouldBlockUI()` is evaluated
- THEN it returns true and `OfflineOverlay` renders

#### Scenario: Online never blocks regardless of queue

- GIVEN `isOffline` is false and the queue holds 5 of 5 orders
- WHEN `useShouldBlockUI()` is evaluated
- THEN it returns false

### Requirement: Ordered Sequential Drain On Reconnection

The system MUST drain queued orders one at a time, in original FIFO order, only after reconnection is detected, and MUST NOT start a new drain attempt while one is in flight.

#### Scenario: Drain processes oldest first

- GIVEN the queue holds orders A, B, C enqueued in that order
- WHEN reconnection is detected and drain starts
- THEN A is submitted before B, and B before C

#### Scenario: Concurrent drain prevented

- GIVEN a drain is already in progress for order A
- WHEN another reconnection event fires
- THEN no second drain attempt starts until the first completes

### Requirement: Backoff Reconnection Detection

The system MUST detect "back online" itself (no existing app-wide event to rely on) using a retry-with-backoff strategy, since any successful RPC or a dedicated probe may indicate connectivity.

#### Scenario: Backoff increases between failed probes

- GIVEN the last drain/probe attempt failed
- WHEN the synchronizer schedules the next attempt
- THEN the delay before the next attempt is greater than or equal to the previous delay, up to a capped maximum

### Requirement: No Duplicate Submissions

The system MUST NOT create more than one Odoo sale order for the same `x_fex_id`, even if a drain attempt is retried after a partial failure (e.g., timeout after the request was actually accepted).

#### Scenario: Retry after ambiguous failure does not duplicate

- GIVEN a drain submission for `x_fex_id` "abc-123" times out after the server may have already processed it
- WHEN the synchronizer retries "abc-123"
- THEN at most one sale order exists in Odoo for that `x_fex_id` (relies on backend dedup by `x_fex_id`)

### Requirement: Partial Drain Failure Handling

The system MUST distinguish transient failures from permanent failures during a drain pass. On a TRANSIENT failure (network/timeout/5xx), the drain MUST stop advancing, leaving the failed entry and all entries after it queued for a future attempt. On a PERMANENT failure (`OdooServerError` — a definitive business-rule rejection from Odoo), the failed entry MUST be marked `failed` (kept in the queue, visible for manual review — a fiscal receipt was already printed for it) and the drain MUST CONTINUE to the next entry, so one bad order does not block the rest of the queue. Entries already successfully drained MUST be removed in both cases.

(Resolved 2026-07-06 — ADR-3 in design.md wins over the original stop-on-first-failure wording; see tasks.md task 3.1.)

#### Scenario: Transient failure mid-drain halts remaining entries

- GIVEN queue entries A, B, C and A drains successfully but B fails with a transient (network/timeout/5xx) error
- WHEN the drain pass ends
- THEN A is removed from the queue, B is reverted to `pending`, and B and C remain queued in original order for the next attempt

#### Scenario: Permanent failure mid-drain skips to the next entry

- GIVEN queue entries A, B, C and A drains successfully but B fails with a permanent `OdooServerError`
- WHEN the drain pass ends
- THEN A is removed from the queue, B is marked `failed` and kept in the queue for manual review, and C is still drained in the same pass

### Requirement: Instance-Scoped Drain

The system MUST drain ONLY queue entries belonging to the currently configured Odoo instance (`odooUrl + odooDb + stationId`). Entries belonging to a different instance MUST NEVER be sent, marked `failed`, or deleted by the current instance's synchronizer — they stay dormant until (if ever) that original instance is reconfigured again. The synchronizer MUST NOT drain anything while the kiosk is unconfigured.

#### Scenario: Foreign-instance entries are skipped entirely during drain

- GIVEN the queue holds an entry tagged with instance A's `instanceKey` and the kiosk is now configured against instance B
- WHEN the synchronizer drains
- THEN instance A's entry is never submitted, never marked `failed`, and never deleted, and instance B's own entries (if any) drain normally

#### Scenario: Reconfiguring back to the original instance resumes draining its dormant entries

- GIVEN an entry was left dormant while the kiosk was configured against a different instance
- WHEN the kiosk is reconfigured back to the original instance and reconnects
- THEN the dormant entry is picked up and drained normally

#### Scenario: Unconfigured kiosk never drains

- GIVEN the kiosk has no instance configured (`isConfigured` is false)
- WHEN a reconnection or backoff-poll trigger fires
- THEN `drain()` performs no submissions and exits immediately

### Requirement: App Restart Mid-Drain Recovery

The system MUST resume draining the persisted queue from its current state after an app restart that occurs mid-drain, without re-submitting entries already confirmed removed.

#### Scenario: Restart resumes remaining queue

- GIVEN the app crashed after entry A was confirmed and removed but before B was submitted
- WHEN the app restarts and reconnects
- THEN the drain resumes starting at B, and A is not resubmitted
