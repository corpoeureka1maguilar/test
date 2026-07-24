# Payment Flow Specification

## Purpose
Ensure a reliable payment flow that cleans up state between different customers, preventing products from previous attempts to show in the cart.

## Requirements

### Requirement: Cart Cleanup on Sale Cancellation
The system MUST clear the cart immediately when a sale is canceled or completed, whether manually by the operator or automatically by inactivity timeouts.

#### Scenario: Manual Cancellation Clears Cart
- GIVEN the customer has added products to the cart
- WHEN the operator clicks the "Cancelar" or "Volver" button that cancels the sale
- THEN the system MUST clear the Zustand cart store
- AND the system MUST transition the state machine to "idle"
- AND the system MUST redirect to the home screen "/"

#### Scenario: Sale Success Clears Cart
- GIVEN the customer has completed payment successfully
- WHEN the operator or countdown finishes the sale
- THEN the system MUST clear the Zustand cart store
- AND the system MUST transition the state machine to "idle"
- AND the system MUST redirect to the home screen "/"

### Requirement: Gift-card selection no longer hard-blocks on insufficient balance (MODIFIED)
The system MUST allow gift-card payments to proceed with a second payment method when the card balance is insufficient to cover the full order total (but greater than zero).

#### Scenario: Gift-card selection no longer hard-blocks on insufficient balance
- GIVEN the current implementation disables confirmation and shows an error whenever `balance < total`
- WHEN this change is applied
- THEN that hard block is removed for the case `0 < balance < total`; the flow instead proceeds with a 2-leg partial payment (gift card + second method).
- AND the case `balance >= total` (full card payment) and the case `balance === 0` / invalid card remain unchanged.
- AND the user is prompted to select a second payment method to cover the remaining amount.
