# offline-order-queue Specification

## Purpose

Defer sale-order creation in Odoo when it is unreachable, without blocking the cashier from completing and printing the sale, while guaranteeing at most one Odoo order per attempt.

## Requirements

### Requirement: Bounded FIFO Queue

The system MUST maintain an IndexedDB-backed queue of pending sale orders with a maximum of 5 entries, in first-in-first-out order.

#### Scenario: Enqueue below limit

- GIVEN the queue currently holds 3 pending orders
- WHEN a new sale completes while offline
- THEN the order is appended as the 4th queue entry

#### Scenario: Queue full rejects new offline sale

- GIVEN the queue currently holds 5 pending orders
- WHEN a cashier attempts to submit payment while offline
- THEN the `processing` state does NOT enqueue a 6th order and the sale flow signals "queue full"

### Requirement: Idempotency Key Reuse

The system MUST key each queued order by the existing `saleAttemptId` (`x_fex_id`) generated once per sale attempt, and MUST resend the exact same payload object on every drain attempt for that entry.

#### Scenario: Same payload resent on drain

- GIVEN an order was enqueued with `x_fex_id` = "abc-123" and a given payload
- WHEN the synchronizer drains that entry
- THEN it submits the identical payload object, unmodified, with the same `x_fex_id`

### Requirement: Enqueue-and-Print Outcome On Sale Completion

The system MUST support a third `processing` outcome — "enqueued offline" — that proceeds to printing the fiscal receipt even though no `odooOrderId` was resolved yet.

#### Scenario: Offline sale still prints

- GIVEN Odoo is unreachable and the queue has room
- WHEN the cashier submits payment
- THEN the order is enqueued, the state transitions to printing, and the fiscal receipt prints successfully

#### Scenario: Printer data reconciled after sync

- GIVEN a previously queued order has now been created in Odoo by the synchronizer
- WHEN the synchronizer receives the resulting `odooOrderId`
- THEN it re-runs the printer-data persistence step for that order using the resolved id

### Requirement: Instance-Scoped Queue And Bound

The system MUST tag every queue entry with the `instanceKey` of the instance it was enqueued under (derived from `odooUrl + odooDb + stationId`). The 5-entry bound (Bounded FIFO Queue) MUST apply PER INSTANCE — a full queue belonging to a different instance MUST NOT block enqueueing for the current instance, and vice versa. Legacy entries persisted before this scoping existed (no `instanceKey`) MUST be tagged, on first boot after the upgrade, with whichever instance is configured at that time.

#### Scenario: A different instance's full queue does not block the current instance

- GIVEN instance A's queue already holds 5 pending entries (its own `instanceKey`)
- WHEN the kiosk, now configured against instance B, enqueues a new sale while offline
- THEN the entry is accepted (instance B's own count is 0 of 5) and tagged with instance B's `instanceKey`

#### Scenario: The current instance's own full queue still rejects new entries

- GIVEN the current instance's queue already holds 5 pending entries under its own `instanceKey`
- WHEN a cashier attempts to submit payment while offline
- THEN the enqueue is rejected with a queue-full error, regardless of how many entries other instances have queued

#### Scenario: Legacy untagged entries are adopted by the current instance on boot

- GIVEN queue entries exist with no `instanceKey` (written before this scoping was added)
- WHEN the kiosk boots and is configured against instance A
- THEN those entries are tagged with instance A's `instanceKey` and count toward instance A's bound and drain

### Requirement: Queue Persistence Across Reloads

The system MUST persist the queue in IndexedDB so pending orders survive a kiosk page reload or crash.

#### Scenario: Queue survives reload

- GIVEN 2 orders are pending in the queue
- WHEN the kiosk app reloads
- THEN the queue still contains the same 2 orders in their original order
