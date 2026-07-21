# Tasks: Backend-Configurable Accent Color

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180-230 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full feature (theme.ts + config.ts + App.tsx + tests) | PR 1 | Small, cohesive, single reviewable diff |

## Phase 1: Foundation — theme.ts (RED)

- [x] 1.1 Create `src/shared/lib/theme.test.ts` with failing tests: `isValidHex` (valid `#10b981`, missing `#`, wrong length, non-hex chars, non-string, empty/blank).
- [x] 1.2 Add failing tests: `normalizeAccent` returns lowercased valid hex, and `DEFAULT_ACCENT` (`#10b981`) for absent/malformed/empty input.
- [x] 1.3 Add failing tests: `deriveAccentShades(hex)` returns `{base, hover, glow, subtle}` — hover is a deterministic ~15% darken (not hardcoded `#059669`), glow/subtle are rgba with correct alpha.
- [x] 1.4 Add failing tests (jsdom): `applyAccentColor(hex)` calls `setProperty` for `--color-accent`, `--color-accent-hover`, `--color-accent-glow`, `--color-accent-subtle` on `documentElement`. Run `npm test` — confirm RED.

## Phase 2: Foundation — theme.ts (GREEN + REFACTOR)

- [x] 2.1 Create `src/shared/lib/theme.ts`: export `DEFAULT_ACCENT = '#10b981'`, `HEX` regex, `isValidHex`, `normalizeAccent`.
- [x] 2.2 Implement `deriveAccentShades(hex)`: darken utility for hover (~15%), rgba glow (alpha 0.2), rgba subtle (alpha 0.05).
- [x] 2.3 Implement `applyAccentColor(hex)`: derive shades, call `setProperty` x4 on `document.documentElement`. Run `npm test` — confirm GREEN.
- [x] 2.4 Refactor for clarity/naming consistency with `money.ts`/`money.test.ts` conventions; re-run tests to confirm still GREEN.

## Phase 3: Store Integration (RED)

- [x] 3.1 Add failing test(s) to `src/shared/stores/config.test.ts` (or create if absent): `accentColor` defaults to `DEFAULT_ACCENT` in initial state.
- [x] 3.2 Add failing test: `saveConfig` parses `x_accent_color` from `action_get_custom_config` response, normalizes it, stores it in `accentColor`, and calls `applyAccentColor`.
- [x] 3.3 Add failing test: `reauthenticate` performs the same parse/store/apply behavior as `saveConfig` (malformed and absent-key cases both fall back to default, no throw).
- [x] 3.4 Add failing test: `clearConfig` resets `accentColor` to `DEFAULT_ACCENT`. Run `npm test` — confirm RED.

## Phase 4: Store Integration (GREEN + REFACTOR)

- [x] 4.1 Modify `src/shared/stores/config.ts`: add `accentColor: string` to `ConfigState`, default `DEFAULT_ACCENT`, include in `partialize`.
- [x] 4.2 In `saveConfig` (line ~111), after existing gift-card parsing, read `x_accent_color`, call `normalizeAccent`, set `accentColor`, call `applyAccentColor`.
- [x] 4.3 In `reauthenticate` (line ~233), mirror the same parse/store/apply logic.
- [x] 4.4 In `clearConfig`, reset `accentColor` to `DEFAULT_ACCENT`. Run `npm test` — confirm GREEN, then refactor for duplication between the two call sites (e.g. small private helper) without changing behavior.

## Phase 5: Eager Bootstrap Apply (RED + GREEN)

- [x] 5.1 Add failing test covering `AppInit` (or extract a small testable unit) applying the persisted `accentColor` via `applyAccentColor` before/independent of `reauthenticate` resolving. (Extracted `applyPersistedAccent()` into `src/shared/lib/bootstrapTheme.ts` to keep the unit testable without importing the full `App.tsx` module graph — minor deviation from design's file list, documented here.)
- [x] 5.2 Modify `src/App.tsx`: call `applyPersistedAccent()` eagerly at module scope (synchronously, before the async reauth call and before first render), preventing default-color flash on cold reload/reconnect. Run `npm test` — confirm GREEN.

## Phase 6: Verification

- [x] 6.1 Run full suite `npm test` — all new and existing tests pass. (306 tests, 36 files, all green.)
- [x] 6.2 Run `npm run typecheck` — no type errors introduced. (Pre-existing unrelated error in `AppVirtualKeyboard.tsx` — untouched by this change, not caused by it.)
- [x] 6.3 Manually cross-check each spec scenario (kiosk-theming/spec.md) against implemented behavior: valid color (covered by config.test.ts saveConfig/reauthenticate tests + theme.test.ts), malformed (config.test.ts reauthenticate fallback test + theme.test.ts isValidHex/normalizeAccent), absent key (config.test.ts reauthenticate fallback test — empty `{}` custom config), two-station differentiation (accentColor is per-station-fetched and applied on every reauth/saveConfig, not cached globally), backend-not-yet-implemented (identical code path to absent-key: `.catch(() => ({}))` on the RPC call already handles this, pre-existing pattern reused).
