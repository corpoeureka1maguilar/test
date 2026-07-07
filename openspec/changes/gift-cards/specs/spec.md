# Specs: Gift Card Integrations

## Scenario 1: Config and Catalog Load
- **Given** Odoo is configured with `x_use_gift_card: True` and `x_gift_card_product: 14`
- **When** the kiosk authenticates/initializes
- **Then** `useGiftCard` should be set to `true` and `giftCardProductId` should be set to `14` in the config store.
- **And** the product with ID `14` in the catalog should be flagged as `isGiftCard: true`.

## Scenario 2: Gift Card Purchase Constraints
- **Given** the cart contains regular products
- **When** the user attempts to add the Gift Card product
- **Then** the cart should be cleared (or prompt user) and contain only the Gift Card product.
- **And** a prompt should request the load amount in USD.
- **And** adding any other product to the cart should be disabled while the Gift Card is in the cart.

## Scenario 3: Payment select
- **Given** the cart has a Gift Card purchase order
- **Then** the "Tarjeta de regalo" payment option should NOT be available.
- **Given** the cart has a regular purchase order and `useGiftCard` is active
- **Then** "Tarjeta de regalo" should be displayed as a payment method.

## Scenario 4: Paying with Gift Card
- **Given** a user selects "Tarjeta de regalo"
- **When** they input the code
- **Then** Odoo should be queried for the card status.
- **If** the card balance is less than the order total:
  - **Then** show an error stating the card cannot cover the full amount and disable confirmation.
- **If** the balance is sufficient:
  - **Then** enable confirmation.
  - **And** when submitted, the payload should have `payments: []` and `giftCard` set to the card details with state `'available'`.
