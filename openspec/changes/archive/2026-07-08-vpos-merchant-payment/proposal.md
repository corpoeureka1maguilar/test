# Proposal: VPOS Merchant Payment (mock-ready integration point)

## Intent
Add a payment path for methods flagged `with_merchant` in Odoo (`x.pos.payment.method`) that hands off to an external card terminal (VPOS), with a local mock server to develop and test against until the real terminal integration is wired.

## Scope

### In Scope
- New `withMerchant` field on `KioskPaymentMethod`, sourced from Odoo's `with_merchant`.
- `PaymentForm.tsx` branch for `method.withMerchant`: ping the terminal endpoint, show connecting/waiting feedback, embed the terminal's checkout UI in an iframe, listen for a `postMessage` result, and submit the payment (`SUBMIT_PAYMENT`) on approval.
- Client-side timeout (60s) if the terminal never responds, with a toast and return to `/pago`.
- `merchant-mock.js`: local HTTP mock exposing `GET /vpos/ping`, `GET /vpos/checkout` (basic HTML form: monto, débito/crédito, clave, aceptar), `POST /vpos/metodo`, `POST /vpos/metodo_cashea`.

### Out of Scope
- Real terminal/gateway integration (Megasoft, Instapago, or similar) — the mock defines the HTTP/postMessage contract the real integration must satisfy.
- Changes to `printer-agent` (no merchant/vpos references found there; not needed).
- Card payment via `eu_fex_ppal` (separate app, not touched).

## Capabilities

### Added Capabilities
- `vpos-merchant-payment`: kiosk payment flow for methods that delegate to an external VPOS terminal.

## Approach
- Extend `odooRepository.ts` (`RawMethod`, `mapMethod`, `fetchPaymentMethods`) to fetch and map `with_merchant`.
- Extend `KioskPaymentMethod` type with `withMerchant?: boolean`.
- In `PaymentForm.tsx`, add a `withMerchant` render branch and a dedicated `useEffect` that: pings the mock, starts a response timeout, listens for `window.message` events carrying the terminal's JSON response (`codRespuesta`), and dispatches `SUBMIT_PAYMENT` on `codRespuesta === '00'`.
- `merchant-mock.js` serves a minimal checkout HTML (no external fonts/decoration) that posts to its own `/vpos/metodo` and relays the JSON response to the parent window via `postMessage`, keeping response-generation logic in one place.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `src/shared/lib/odooRepository.ts` | Modified | Fetch/map `with_merchant` field |
| `src/shared/types/types.ts` | Modified | Add `withMerchant?: boolean` to `KioskPaymentMethod` |
| `src/features/payment/pages/PaymentForm.tsx` | Modified | New VPOS branch: ping, timeout, iframe, postMessage listener, loader UI |
| `merchant-mock.js` | Modified | Add `/vpos/checkout` mock UI; `tipoTarjeta` now reflected in mock response |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Terminal never responds (hang) | Medium | 60s client-side timeout returns to `/pago` with a toast |
| Terminal unreachable at flow start | Medium | Ping check before waiting; immediate error + return if it fails |
| Real integration contract differs from mock | Medium | Mock's `postMessage` payload matches the existing `cardTerminal.contract.test.ts` VPOS response shape |

## Rollback Plan
Revert the four files above; `with_merchant` field fetch is additive and safe to drop.

## Success Criteria
- [x] Payment methods with `with_merchant = true` route to the VPOS screen instead of the generic form.
- [x] Screen pings the terminal before waiting; unreachable terminal shows an error and returns to `/pago`.
- [x] Screen times out after 60s of no response and returns to `/pago`.
- [x] Approved mock payment (`codRespuesta === '00'`) submits the payment and navigates to `/resultado`.
- [x] Rejected mock payment shows an error toast and stays on screen.
