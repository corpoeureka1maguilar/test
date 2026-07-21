# Kiosk Theming Specification

## Purpose

Allow each kiosk/station to display its own backend-configured accent color, applied at runtime without a frontend rebuild, while remaining fully functional when the backend does not provide one.

## Requirements

### Requirement: Read Accent Color From Station Config

The system MUST read the accent color from the `x_accent_color` key inside the `action_get_custom_config` dict returned for `x.pos.station`, using the same config-loading path as `x_use_gift_card` and `ad_configs`.

#### Scenario: Station config includes a valid accent color

- GIVEN the station's `action_get_custom_config` response includes `x_accent_color: "#10b981"`
- WHEN the app loads or refreshes the station config (login, reauthenticate, or config refresh)
- THEN the app reads `x_accent_color` as the candidate accent color

#### Scenario: Station config omits the accent color key

- GIVEN the station's `action_get_custom_config` response does not include `x_accent_color`
- WHEN the app loads or refreshes the station config
- THEN the app treats the accent color as absent and proceeds to the fallback behavior

### Requirement: Validate Hex Format Before Applying

The system MUST validate that `x_accent_color` is a well-formed 6-digit hex color string with a leading `#` (e.g. `#10b981`) before applying it. The system MUST NOT apply a value that fails validation.

#### Scenario: Value matches expected hex format

- GIVEN `x_accent_color` is `"#10b981"`
- WHEN the app validates the value
- THEN the value is accepted as valid and used as the applied accent color

#### Scenario: Value is malformed

- GIVEN `x_accent_color` is `"10b981"` (missing `#`), `"#10b98"` (wrong length), `"#zzzzzz"` (non-hex characters), or any other non-conforming string
- WHEN the app validates the value
- THEN the value is rejected
- AND the system falls back to the default accent color

#### Scenario: Value is empty or blank

- GIVEN `x_accent_color` is an empty string or whitespace-only
- WHEN the app validates the value
- THEN the value is rejected
- AND the system falls back to the default accent color

### Requirement: Apply Accent Color At Runtime

The system MUST apply the validated accent color by calling `document.documentElement.style.setProperty('--color-accent', value)`, at the same lifecycle point where the company logo and exchange rate are refreshed (login, reauthenticate, and config refresh), so the color is present before first paint on reconnect.

#### Scenario: Valid color applied on config refresh

- GIVEN a valid `x_accent_color` was read and validated
- WHEN the config refresh lifecycle runs (login, reauthenticate, or reconnect)
- THEN `--color-accent` on the document root is set to the validated value
- AND the change is visible without a page rebuild or redeploy

#### Scenario: Two stations show different colors

- GIVEN Station A has `x_accent_color: "#10b981"` and Station B has `x_accent_color: "#3b82f6"`, both in the same branch
- WHEN each station loads its own config
- THEN Station A renders with `--color-accent: #10b981` and Station B renders with `--color-accent: #3b82f6`

### Requirement: Derive Dependent CSS Variables

The system MUST derive `--color-accent-hover`, `--color-accent-glow`, and `--color-accent-subtle` from the applied base accent color (validated value or default), and apply all of them via `setProperty`, so all consuming components stay visually consistent.

#### Scenario: Derived shades follow the base color

- GIVEN a validated accent color has been applied to `--color-accent`
- WHEN the derived variables are computed
- THEN `--color-accent-hover`, `--color-accent-glow`, and `--color-accent-subtle` are set on the document root as shades derived from that same base color

### Requirement: Fallback to Default Accent Color

The system MUST fall back to the default accent color `#10b981` whenever `x_accent_color` is absent, empty, or fails hex validation, ensuring the kiosk UI never renders without an accent color and never throws an error due to a bad config value.

#### Scenario: Absent key falls back to default

- GIVEN `x_accent_color` is not present in the station config
- WHEN the config refresh lifecycle runs
- THEN `--color-accent` is set to `#10b981`
- AND no error is raised

#### Scenario: Malformed key falls back to default

- GIVEN `x_accent_color` is present but fails hex validation
- WHEN the config refresh lifecycle runs
- THEN `--color-accent` is set to `#10b981`
- AND no error is raised

#### Scenario: Backend contract not yet available

- GIVEN the backend has not yet implemented `x_accent_color` in `action_get_custom_config`
- WHEN the app loads any station config
- THEN the app behaves identically to the absent-key scenario
- AND the kiosk remains fully functional with the default accent color
