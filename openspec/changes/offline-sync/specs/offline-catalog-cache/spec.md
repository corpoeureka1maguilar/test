# offline-catalog-cache Specification

## Purpose

Persist the product catalog and payment methods in IndexedDB so the kiosk can browse and check out while Odoo is unreachable, without ever serving stale data over a fresher one.

## Requirements

### Requirement: Product Cache Persistence

The system MUST persist fetched products in IndexedDB, replacing the entire cached set on every successful refresh (no incremental merge across sessions), capped at 5000 entries.

#### Scenario: Successful refresh replaces cache

- GIVEN a cache with 200 previously stored products
- WHEN `fetchProducts` succeeds with a new set of 180 products
- THEN the cache is replaced entirely with the new 180 products

#### Scenario: Ceiling enforced defensively

- GIVEN a fetch returns more than 5000 products
- WHEN the cache write runs
- THEN only the first 5000 are persisted and the excess is discarded

### Requirement: Catalog Served From Cache When Offline

The system MUST serve the last cached product list to the UI when Odoo is unreachable, instead of an empty or error state.

#### Scenario: Offline read from cache

- GIVEN a non-empty product cache exists and `isOffline` is true
- WHEN the catalog hook resolves data
- THEN it returns the cached products without attempting a network refresh

#### Scenario: Empty cache offline

- GIVEN no products have ever been cached and `isOffline` is true
- WHEN the catalog hook resolves data
- THEN it returns an empty list without throwing

### Requirement: Refresh Only While Online

The system MUST NOT attempt to write or refresh the cache while offline; a failed fetch MUST leave the existing cache untouched.

#### Scenario: Failed fetch preserves cache

- GIVEN a cache with 150 products
- WHEN `fetchProducts` fails (network/timeout/5xx)
- THEN the cache still contains the same 150 products afterward

### Requirement: Payment Method Cache Offline

The system MUST cache payment methods in IndexedDB using the same replace-on-refresh policy as products, and serve them from cache when offline.

#### Scenario: Payment methods available offline

- GIVEN payment methods were cached during a prior online session
- WHEN the cashier reaches `selectingMethod` while offline
- THEN the cached payment methods are shown and selectable

#### Scenario: No payment methods ever cached

- GIVEN payment methods were never cached and the kiosk is offline
- WHEN the cashier reaches `selectingMethod`
- THEN the method list is empty and checkout cannot proceed past this step

### Requirement: Instance-Scoped Catalog Cache

The system MUST scope the product and payment-method caches to the currently configured Odoo instance (derived from `odooUrl + odooDb + stationId`). A cache row written under one instance MUST NOT be served to a different instance. Cache rows written before this scoping existed (no `instanceKey` recorded) MUST be treated as belonging to whichever instance is configured the first time they are read after the upgrade, and tagged with that instance from then on. When the kiosk is unconfigured, no cached data may be served.

#### Scenario: Cache from a previous instance is not served to a new instance

- GIVEN the product cache was written while configured against instance A (`odooUrl=A, odooDb=A, stationId=1`)
- WHEN the kiosk is reconfigured against instance B (`odooUrl=B, odooDb=B, stationId=2`) and the catalog hook resolves data
- THEN the cache returns an empty list instead of instance A's products

#### Scenario: Legacy untagged cache is adopted by the first instance that reads it

- GIVEN a cache row exists with no `instanceKey` (written before this scoping was added)
- WHEN the kiosk, currently configured against instance A, reads the cache for the first time
- THEN the cached data is served AND the row is tagged with instance A's key so a later instance B never sees it

#### Scenario: Unconfigured kiosk never serves cached data

- GIVEN the kiosk has no instance configured (`isConfigured` is false)
- WHEN the catalog hook resolves data
- THEN it returns an empty list regardless of what is stored in IndexedDB

### Requirement: Storage Quota Handling

The system MUST handle `QuotaExceededError` (or equivalent) during a cache write without crashing the app or losing the previously stored cache.

#### Scenario: Quota exceeded on write

- GIVEN IndexedDB rejects a write with a quota error
- WHEN the catalog or payment-method cache attempts to persist new data
- THEN the write is aborted, the error is logged, and the prior cached data remains readable
