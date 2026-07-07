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
