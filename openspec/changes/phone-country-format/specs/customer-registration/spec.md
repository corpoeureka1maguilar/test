# Delta for Customer Registration

## ADDED Requirements

### Requirement: Country-Aware Phone Field Selection

The system MUST derive the customer's phone entry mode from the existing
nationality signal (`vat.startsWith('V-')`) without introducing a new form
field. Venezuelan customers MUST see the carrier quick-select phone UX;
non-Venezuelan customers MUST see an international `+<country-code>` phone
entry with its own formatting and validation.

#### Scenario: Venezuelan customer sees carrier quick-select

- GIVEN the operator is registering a customer whose cédula/RIF starts with `V-`
- WHEN the phone field renders
- THEN the system MUST show the Venezuelan carrier quick-select prefixes
  (0412/0414/0424/0416/0426/0422)
- AND the system MUST validate and format the phone using the existing
  Venezuelan phone rules

#### Scenario: Non-Venezuelan customer sees international entry

- GIVEN the operator is registering a customer whose cédula/RIF does not
  start with `V-`
- WHEN the phone field renders
- THEN the system MUST show an international `+<country-code>` phone input
  instead of the Venezuelan carrier prefixes
- AND the system MUST validate and format the phone using real international
  phone rules (not a no-op passthrough)

#### Scenario: Switching nationality signal updates the field

- GIVEN the operator has entered a cédula/RIF that changes the `V-` prefix
  determination
- WHEN the nationality signal changes before the phone field is submitted
- THEN the system MUST re-render the phone field in the mode matching the
  current nationality signal
- AND the system MUST NOT carry over formatting or validation rules from the
  previous mode

---

### Requirement: Virtual Keyboard Value Integrity for Phone Field

The on-screen numeric keyboard MUST append, edit, and confirm digits for the
phone field through a single, controlled value/onChange source. The keyboard
MUST NOT reset or corrupt a previously entered value, including immediately
after a carrier quick-select prefix tap.

#### Scenario: Typing after quick-select prefix preserves the value

- GIVEN the operator has tapped a Venezuelan carrier quick-select prefix
  (e.g. `0424`)
- WHEN the operator then types additional digits on the on-screen keyboard
- THEN the system MUST append the typed digits to the prefix already shown
- AND the system MUST NOT overwrite, duplicate, or stack the prefix with a
  stale cached value

#### Scenario: Sequential keypresses never desync from displayed value

- GIVEN the phone field has a partially entered value
- WHEN the operator presses multiple keys in sequence on the on-screen
  keyboard
- THEN each keypress MUST update the same single source of truth used to
  render the field
- AND the displayed value MUST always match the value used for validation
  and submission

#### Scenario: Editing (backspace) does not resurrect stale digits

- GIVEN the phone field has a value entered via a mix of quick-select and
  manual keypresses
- WHEN the operator deletes one or more digits using the keyboard's
  backspace
- THEN the system MUST remove digits from the current displayed value only
- AND the system MUST NOT reintroduce digits from a previously cached or
  stale value

---

### Requirement: Isolated Per-Country Phone Logic Seam

Phone formatting, validation, and prefix-list logic for each supported
nationality mode MUST be isolated behind a single seam (a dedicated hook and
its per-country presentational components), and MUST NOT be branched
directly inside the customer registration page component beyond a single
mode-selection point.

#### Scenario: Page delegates to the phone seam

- GIVEN the customer registration page needs to render the phone field
- WHEN it determines whether the customer is Venezuelan or international
- THEN the page component MUST perform at most one conditional to select
  between the Venezuelan and international phone components
- AND the page component MUST NOT contain country-specific formatting or
  validation logic inline

#### Scenario: Adding a new country's rules does not touch the page

- GIVEN a future requirement to support a new per-country phone format
- WHEN that format is added to the phone logic seam (hook/components)
- THEN the change MUST NOT require modifying conditionals inside the
  customer registration page component beyond the existing single
  mode-selection point
