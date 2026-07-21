# Tasks: VPOS Merchant Payment

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180 lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Low

### Suggested Work Units
- **Unit 1**: Data layer — `with_merchant` field (odooRepository + types).
- **Unit 2**: Kiosk UI — VPOS screen, ping/timeout, postMessage handling.
- **Unit 3**: Mock server — checkout HTML + endpoint wiring.

## Phase 1: Data Layer
- [x] 1.1 Add `with_merchant` to `RawMethod` in `src/shared/lib/odooRepository.ts`.
- [x] 1.2 Map `with_merchant` → `withMerchant` in `mapMethod`.
- [x] 1.3 Include `with_merchant` in the `search_read` fields list.
- [x] 1.4 Add `withMerchant?: boolean` to `KioskPaymentMethod` in `src/shared/types/types.ts`.
- [x] 1.5 Update `odooRepository.test.ts` fixtures/expectations for `with_merchant`/`withMerchant`.

## Phase 2: Kiosk UI
- [x] 2.1 Add `vposStatus` state (`'checking' | 'waiting'`) to `PaymentForm.tsx`.
- [x] 2.2 Add `useEffect` for `method.withMerchant`: ping, conditional timeout start, `message` listener, cleanup.
- [x] 2.3 On ping failure: toast error, `send(BACK)`, `navigate('/pago')`.
- [x] 2.4 On 60s timeout: toast error, `send(BACK)`, `navigate('/pago')`.
- [x] 2.5 On `codRespuesta === '00'`: `send(SUBMIT_PAYMENT)`, `navigate('/resultado')`.
- [x] 2.6 On rejection: toast error, stay on screen.
- [x] 2.7 Render branch: spinner while `checking`, iframe (`{base}/vpos/checkout`) while `waiting`.

## Phase 3: Mock Server
- [x] 3.1 Add `renderCheckoutHtml(amount, cedula)` to `merchant-mock.js`.
- [x] 3.2 Add `GET /vpos/checkout` route serving the checkout HTML.
- [x] 3.3 Checkout HTML posts to `/vpos/metodo` and relays the response via `postMessage`.
- [x] 3.4 `POST /vpos/metodo` reflects `payload.tipoTarjeta` in the response instead of a hardcoded value.

## Phase 4: Testing & Verification
- [x] 4.1 `npx tsc --noEmit` passes.
- [x] 4.2 `npx vitest run` on `odooRepository.test.ts` and `cardTerminal.contract.test.ts` passes.
- [ ] 4.3 Manual run of `node merchant-mock.js` + kiosk dev server against ping-fail, timeout, approve, and reject cases.
