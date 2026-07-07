# Customer Registration Specification

## Purpose
Ensure that new customers are registered with complete and valid address data, selecting from official states and typed using a virtual keyboard that behaves properly.

## Requirements

### Requirement: Mandatory Fields and Minimum Length
The fields "Dirección" (street) and "Estado" (state) MUST be mandatory and MUST contain at least 5 characters.

#### Scenario: Submitting with Empty Mandatory Fields
- GIVEN the operator is registering a new customer
- WHEN they leave "Dirección" or "Estado" empty and submit
- THEN the system MUST reject submission
- AND the system MUST display a validation error message indicating the field is required

#### Scenario: Submitting with Short Fields
- GIVEN the operator is registering a new customer
- WHEN they enter a value of less than 5 characters for "Dirección" or "Estado" and submit
- THEN the system MUST reject submission
- AND the system MUST display a validation error message indicating the field must have at least 5 characters

---

### Requirement: State Selection from res.country.state
The system MUST retrieve the list of Venezuelan states from Odoo's `res.country.state` model, show them as suggestion dropdown options when focusing the "Estado" input, and fall back to a local static list if the Odoo request fails.

#### Scenario: Show Suggestions on Focus
- GIVEN the operator focuses the "Estado" input field
- WHEN the list of states is loaded (either from Odoo or fallback)
- THEN the system MUST display a suggestions dropdown matching the typed input

#### Scenario: Selecting a State from Suggestions
- GIVEN the suggestions dropdown is visible for "Estado"
- WHEN the operator clicks a state suggestion
- THEN the system MUST set the input value to the selected state
- AND the suggestions dropdown MUST close

---

### Requirement: Virtual Keyboard Autofocus and Blur behavior
The virtual keyboard MUST remain visible while the operator is typing on it and MUST close when they blur the active input by clicking outside.

#### Scenario: Clicking Keyboard Keys Does Not Blur Input
- GIVEN the virtual keyboard is open and an input field is active
- WHEN the operator clicks a key on the virtual keyboard
- THEN the active input field MUST NOT lose focus
- AND the keyboard MUST remain visible

#### Scenario: Clicking Outside Closes Keyboard
- GIVEN the virtual keyboard is open and an input field is active
- WHEN the operator clicks outside the input fields and the virtual keyboard area
- THEN the active input field MUST lose focus (blur)
- AND the virtual keyboard MUST hide
