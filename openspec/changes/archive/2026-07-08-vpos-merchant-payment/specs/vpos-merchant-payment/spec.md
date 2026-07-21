## ADDED Requirements

### Requirement: VPOS Terminal Handoff
The system MUST route payment methods flagged `with_merchant` to a dedicated VPOS screen instead of the generic payment form.

#### Scenario: Method with with_merchant renders the VPOS screen
- GIVEN a payment method with `withMerchant = true` is selected
- WHEN the payment form renders
- THEN the system MUST show the VPOS screen instead of the standard form fields

### Requirement: Terminal Reachability Check
The system MUST verify the VPOS terminal is reachable before waiting for a payment result.

#### Scenario: Terminal ping fails
- GIVEN the VPOS screen is entered
- WHEN `GET {base}/vpos/ping` fails or does not return a successful status
- THEN the system MUST show an error toast
- AND the system MUST return to the payment method selection screen ("/pago")

#### Scenario: Terminal ping succeeds
- GIVEN the VPOS screen is entered
- WHEN `GET {base}/vpos/ping` returns a successful status
- THEN the system MUST display the terminal's checkout UI and start waiting for a result

### Requirement: Payment Result Handling
The system MUST process the VPOS terminal's result and submit or reject the payment accordingly.

#### Scenario: Terminal approves the payment
- GIVEN the VPOS checkout UI is displayed
- WHEN a `message` event is received with `codRespuesta === '00'`
- THEN the system MUST submit the payment with the terminal's reference number
- AND the system MUST navigate to "/resultado"

#### Scenario: Terminal rejects the payment
- GIVEN the VPOS checkout UI is displayed
- WHEN a `message` event is received with `codRespuesta !== '00'`
- THEN the system MUST show an error toast with the terminal's rejection message
- AND the system MUST remain on the VPOS screen

### Requirement: Response Timeout
The system MUST NOT wait indefinitely for the VPOS terminal to respond.

#### Scenario: Terminal never responds
- GIVEN the VPOS screen is waiting for a result after a successful ping
- WHEN 60 seconds elapse without a `message` event
- THEN the system MUST show an error toast
- AND the system MUST return to the payment method selection screen ("/pago")

### Requirement: Development Mock Server
The system MUST provide a local mock server implementing the VPOS HTTP contract for development and testing.

#### Scenario: Mock exposes ping, checkout, and transaction endpoints
- GIVEN `merchant-mock.js` is running
- WHEN a client calls `GET /vpos/ping`, `GET /vpos/checkout`, `POST /vpos/metodo`, or `POST /vpos/metodo_cashea`
- THEN the mock MUST respond according to the VPOS contract (`cardTerminal.contract.test.ts`)

#### Scenario: Mock checkout page collects card type and clave
- GIVEN a client requests `GET /vpos/checkout?amount=X&cedula=Y`
- WHEN the page is rendered
- THEN it MUST display the amount, a débito/crédito selector, a clave input, and an "Aceptar" button
- AND submitting MUST post the result to the parent window via `postMessage`
