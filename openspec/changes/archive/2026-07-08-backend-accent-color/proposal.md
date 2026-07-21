# Proposal: Backend-Configurable Accent Color

## Intent
The kiosk accent color is hardcoded in CSS (`--color-accent: #10b981` and derived variables in `src/assets/index.css`). Each physical kiosk/station should be able to display its own brand accent color, set from Odoo without a frontend rebuild or redeploy. This enables per-station theming even for stations sharing the same branch.

## Scope

### In Scope (this repo — `eu_fex_autopay`)
- Read the accent color from the existing `action_get_custom_config` dict on `x.pos.station` (same bag that already carries `x_use_gift_card`, `ad_configs`).
- Apply the color at runtime via `document.documentElement.style.setProperty('--color-accent', value)`, alongside the existing companyLogo/exchange-rate refresh lifecycle.
- Derive the dependent variables (`--color-accent-hover`, `--color-accent-glow`, `--color-accent-subtle`) from the base hex so all 15 consuming files stay consistent.
- Validate the incoming value; fall back to the current default `#10b981` when absent or malformed.

### Out of Scope
- Backend field/dict changes in `eu_agroo_fex_integration_v19` (separate repo — see Dependencies).
- Introducing a ThemeProvider/React context or a full theming system (only `--color-accent` family is configurable).
- Branch-level (`res.branch`) color storage — explicitly rejected in favor of station-level.
- Runtime color picker / admin UI inside the kiosk.

## Capabilities

### New Capabilities
- `kiosk-theming`: Runtime application of a backend-provided accent color to the kiosk UI, with derivation of dependent CSS variables and a safe default fallback.

### Modified Capabilities
- None.

## Approach
Extend the `customConfig` parse in `src/shared/stores/config.ts` (`saveConfig`/`reauthenticate`) to pick up the accent key. Store it in the config store (persisted via `partialize`). Apply it as a DOM side-effect at the same lifecycle point where companyLogo and exchange rate are already refreshed, so the color is present before first paint on reconnect. A single helper computes the hover/glow/subtle shades from the base hex.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/shared/lib/odooRepository.ts` | Modified | Surface accent key from `action_get_custom_config` |
| `src/shared/stores/config.ts` | Modified | Parse, persist, and apply accent color |
| `src/assets/index.css` | Modified | Default stays as fallback baseline |
| new helper (shared/lib) | New | Hex → derived CSS variable shades |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Malformed/empty hex from backend | Med | Validate hex; fall back to `#10b981` |
| Low-contrast color hurts readability | Med | Document guidance; keep default; no auto-contrast in v1 |
| Backend contract not yet delivered | High | Fallback keeps app fully functional until key exists |

## Rollback Plan
Revert the config.ts/odooRepository.ts changes; the hardcoded `--color-accent` in `index.css` remains untouched and resumes as the sole source of the accent color. No data migration involved.

## Dependencies
- **`eu_agroo_fex_integration_v19` backend contract** for `x.pos.station.action_get_custom_config`:
  - Key name: `x_accent_color` (proposed — confirm with backend).
  - Format: 6-digit hex string with leading `#` (e.g. `#10b981`).
  - Absent/empty → frontend applies the default `#10b981`.

## Success Criteria
- [ ] A valid `x_accent_color` from the station config changes the kiosk accent (and derived shades) at runtime, no rebuild.
- [ ] Absent or malformed value → UI renders with the `#10b981` default, no errors.
- [ ] Two stations in the same branch can show different accent colors.
