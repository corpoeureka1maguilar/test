---
name: clean-ui-language
description: >
  Ensures that any generated user interface (UI) uses clear, human, end-user-understandable language, removing technical jargon, programming terms, variable names, internal IDs, technical states, or any text that would not make sense to a non-programmer. Use this skill ALWAYS when building, designing, or modifying any UI component: buttons, labels, error messages, placeholders, tooltips, titles, empty states, notifications, modals, forms, or any user-facing text. Also trigger it when the user asks to "review the interface text," "improve the labels," "make it clearer," "clean up the language," or when you notice terms like null, undefined, snake_case, camelCase, numeric IDs, states like 'PENDING_APPROVAL', or raw code visible in UI text.
---

# Clean UI Language

When coding user interfaces, **all text visible to the end user must be human, clear, and contextual language**. This skill defines the rules and process for achieving that.

---

## Core principle

> "If a non-programmer user saw this text, would they understand it without help?"

If the answer is **no**, the text must be rewritten before it goes into the UI.

---

## What must NEVER appear in the UI

### Technical programming terms

- Variable names: `userData`, `invoiceObj`, `selectedItems`
- snake_case or camelCase: `first_name`, `createdAt`, `isActive`
- Data types: `null`, `undefined`, `NaN`, `boolean`, `Array`, `Object`
- Uppercase internal states: `PENDING`, `APPROVED`, `NULL_STATE`, `LOADING`
- Technical IDs: `id: 4821`, `uuid: a3f2...`, `ref: INV-00291-RAW`
- Model or table names: `invoice.partner_id`, `res.partner`, `sale.order`
- Console messages or stack traces shown in the UI

### Raw error messages

```
// BAD
Error: Cannot read property 'name' of undefined
ValidationError: field 'amount' must be > 0
404: Record not found
```

### Empty states without context

```
// BAD
No data
Empty
null
[]
```

### Actions without a clear subject

```
// BAD
Execute
Process
Submit object
Run handler
```

---

## What must ALWAYS appear

### User- and context-oriented language

```
// GOOD
"You don't have any invoices yet"
"Add your first invoice to get started"
"Loading your data..."
"Something went wrong while saving. Please try again."
```

### Actions with clear verbs and explicit objects

```
// GOOD
"Save invoice"
"Create new customer"
"Download report"
"View payment history"
```

### Useful, friendly error messages

```
// GOOD
"We couldn't process the payment. Make sure the amount is greater than zero."
"We couldn't find that customer. Try searching by name or tax ID."
"Something went wrong. Contact support if this keeps happening."
```

### Empty states with an actionable next step

```
// GOOD (empty state)
Title: "You don't have any suppliers yet"
Subtitle: "Add your first supplier to start managing purchases."
Button: "Add supplier"
```

---

## Quick conversion table

| Technical text       | Clean UI text                          |
| -------------------- | -------------------------------------- |
| `null` / `undefined` | (hide) or "No information available"   |
| `PENDING_APPROVAL`   | "Pending approval"                     |
| `createdAt`          | "Created on"                           |
| `partner_id`         | "Supplier" or "Customer"               |
| `No data available`  | "There's nothing to show here yet"     |
| `Error 500`          | "An unexpected error occurred"         |
| `Loading...`         | "Loading..." or "Fetching your data"   |
| `Submit`             | "Save", "Confirm", "Send"              |
| `Delete`             | "Delete [object name]"                 |
| `id: 3821`           | (hide or show as a readable reference) |
| `True` / `False`     | "Active" / "Inactive" or "Yes" / "No"  |
| `res.partner`        | "Contact" or "Customer"                |
| `sale.order`         | "Sales order"                          |

---

## Process when generating UI

Follow these steps, in order, before writing any visible text:

1. **Identify the user's context**: What are they trying to do? What do they expect to see?
2. **Translate every label and message** using the conversion table or the core principle above.
3. **Review special states**: empty, loading, error, success - all must have clean text.
4. **Check buttons and actions**: must have verb + object (e.g. "Create invoice," not "Create").
5. **Check error messages**: must explain what happened and what the user can do about it.
6. **Remove any reference to internal structure**: model names, technical fields, raw IDs.

---

## Special cases

### Forms

- `placeholder` text must be a real example, not the field name:
  - Bad: `placeholder="partner_name"`
  - Good: `placeholder="e.g. Acme Distribution Co."`
- `label` text must be the business concept name:
  - Bad: `<label>amount_total</label>`
  - Good: `<label>Total amount due</label>`

### Tables and lists

- Column headers must use domain language, not model field names:
  - Bad: `invoice_date_due` | `payment_state` | `partner_id`
  - Good: `Due date` | `Payment status` | `Customer`

### Notifications and toasts

- Always include: what happened plus (if applicable) what to do next.
  - Bad: `"Record saved"`
  - Good: `"Invoice saved successfully"`
  - Bad: `"Operation failed"`
  - Good: `"We couldn't save your changes. Check the fields marked in red."`

### Confirmation modals

- The title should state the action, not the method:
  - Bad: `"Run delete_record?"`
  - Good: `"Delete this invoice?"`
- The confirm button should restate the action:
  - Bad: `"OK"` / `"Yes"`
  - Good: `"Yes, delete it"` / `"Confirm payment"`

---

## Language and tone

- **Language**: match the application's language. Never mix languages within the same UI.
- **Tone**: direct, respectful, jargon-free.
- **Length**: error messages and empty states can be 1-2 sentences. Tooltips should be a single short phrase.

---

## Checklist before delivering UI code

- [ ] Is all visible text in the correct language?
- [ ] Does no text contain snake_case, camelCase, raw IDs, or model terms?
- [ ] Do empty states have a title plus description plus (if applicable) action?
- [ ] Are error messages useful and free of stack traces?
- [ ] Do buttons have a clear verb plus object?
- [ ] Are placeholders real examples rather than field names?
- [ ] Are column headers business-friendly names?
- [ ] Do confirmation modals restate the action in the confirm button?
