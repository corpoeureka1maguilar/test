# Design: Backend-Configurable Accent Color

## Technical Approach

`action_get_custom_config` is called **inline** via `odooEnv.callMethod<Record<string, any>>('x.pos.station', 'action_get_custom_config')` at two points in `src/shared/stores/config.ts`: `saveConfig` (line 111) and `reauthenticate` (line 233). Both already parse `x_use_gift_card`/`x_gift_card_product` from the returned dict. There is NO shared wrapper for this dict in `odooRepository.ts` (`fetchAdvertisements` at :492 calls the same RPC but only returns `ad_configs`), so the accent key is parsed at those same two inline sites — no new RPC is added.

We read `x_accent_color`, normalize it through a validator, store it in the config store (persisted), and apply it as a DOM side-effect via `document.documentElement.style.setProperty`. A single helper derives the three dependent variables from the base hex so all 15 consumers stay consistent with `index.css`.

## Architecture Decisions

### Decision: Apply in config store, not odooRepository
**Choice**: Parse + apply inside `saveConfig`/`reauthenticate` in `config.ts`.
**Alternatives**: Wrapper fetch in `odooRepository.ts`; apply from `App.tsx` AppInit next to exchange-rate refresh.
**Rationale**: The dict is already consumed inline here alongside gift-card keys. `reauthenticate` is invoked on cold reload, on reconnect, and on the 30-min interval (via `AppInit.run()`), so applying here guarantees the color is set on every connection-ready event — same lifecycle as `companyLogo`.

### Decision: Persist accent + eager apply on bootstrap
**Choice**: Add `accentColor: string` to `ConfigState` (default `#10b981`), include in `partialize`; apply the persisted value once on `AppInit` mount before reauth resolves.
**Alternatives**: Apply only after network reauth returns.
**Rationale**: Cold reload paints before the async reauth completes. Applying the persisted value eagerly avoids a flash of default green on already-themed stations.

### Decision: Derive shades by RGB transform (hover is approximate)
**Choice**: `deriveAccentShades(hex)` → `{ hover: darken ~15%, glow: rgba(r,g,b,0.2), subtle: rgba(r,g,b,0.05) }`.
**Alternatives**: Require backend to send all four values.
**Rationale**: Single source (base hex) keeps contract minimal. `hover` is a deterministic darken, NOT the hand-tuned `#059669`; acceptable for v1 (documented).

## Data Flow

    x.pos.station.action_get_custom_config
        └─ { x_accent_color: "#10b981" }
             │  (saveConfig / reauthenticate)
             ▼
    normalizeAccent() ──valid?──► store.accentColor (persisted)
             │                          │
             ▼                          ▼
    applyAccentColor(hex) ──► documentElement.style.setProperty
        --color-accent / -hover / -glow / -subtle
             ▲
    AppInit mount (eager, reads persisted value)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/shared/lib/theme.ts` | Create | `isValidHex`, `normalizeAccent`, `deriveAccentShades`, `applyAccentColor` |
| `src/shared/lib/theme.test.ts` | Create | Unit tests for the helpers above |
| `src/shared/stores/config.ts` | Modify | Add `accentColor` to state + `partialize`; parse `x_accent_color` and call `applyAccentColor` in `saveConfig`/`reauthenticate`; reset on `clearConfig` |
| `src/App.tsx` | Modify | On `AppInit` mount, eagerly `applyAccentColor(store.accentColor)` |
| `src/assets/index.css` | Unchanged | `:root` values remain the fallback baseline |

## Interfaces / Contracts

```ts
// src/shared/lib/theme.ts
export const DEFAULT_ACCENT = '#10b981'
const HEX = /^#[0-9a-fA-F]{6}$/

export function isValidHex(v: unknown): v is string {
  return typeof v === 'string' && HEX.test(v)
}
export function normalizeAccent(v: unknown): string {
  return isValidHex(v) ? (v as string).toLowerCase() : DEFAULT_ACCENT
}
export function deriveAccentShades(hex: string): {
  base: string; hover: string; glow: string; subtle: string
}
export function applyAccentColor(hex: string): void // setProperty x4 on documentElement
```

Backend contract (external, `eu_agroo_fex_integration_v19`): dict key `x_accent_color`, value = 6-digit hex with leading `#`. Absent/invalid → frontend uses `#10b981`.

## Typing

`customConfig` is `Record<string, any>`, so `x_accent_color` reads without a type error. Optional: declare `interface StationCustomConfig { x_accent_color?: string; x_use_gift_card?: boolean; ... }` for clarity — nice-to-have, not required for correctness.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `isValidHex` (valid/short/missing-#/non-string), `normalizeAccent` fallback, `deriveAccentShades` output | vitest, co-located `theme.test.ts` (mirrors `money.test.ts`) |
| Unit (DOM) | `applyAccentColor` sets all 4 custom properties | vitest + jsdom (already configured); assert `documentElement.style.getPropertyValue` |
| Integration | Store applies color after `reauthenticate` / falls back on malformed | Optional, follows `session.test.ts` store precedent |

Runner: `vitest run` (`npm test`). No new deps — jsdom, testing-library already present.

## Migration / Rollout

No migration. New persisted `accentColor` defaults to `#10b981`; existing configs rehydrate missing key to the default via the store initializer. Backend key can ship later — fallback keeps the app fully functional meanwhile.

## Open Questions

- [ ] Confirm `hover` approximation (darken ~15%) is acceptable vs. requiring backend to send the exact hover shade.
- [ ] Backend key name `x_accent_color` confirmed by user; pending delivery in `eu_agroo_fex_integration_v19`.
