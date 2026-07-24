# Proposal: Gift Card + N Cobros VPOS Sucesivos

## Intent

Hoy una venta parcial admite **exactamente 2 piernas**: gift card + un método final que SIEMPRE cierra la venta. El estado en `saleMachine.ts` es singular (`giftCardLeg`/`remainingAmount`) y el flujo VPOS (`useVposCheckout.ts:58-67`) dispara `SUBMIT_PAYMENT` y navega a `/resultado` de forma incondicional al confirmar el terminal (`codRespuesta === '00'`). Un cobro VPOS solo puede ser el cierre, nunca una pierna intermedia.

El negocio real necesita: **una pierna opcional de gift card MÁS N cobros VPOS sucesivos** (ej. tarjeta A cubre $30, tarjeta B cubre los $20 restantes) hasta cubrir el total. Los únicos métodos de producción son los `with_merchant=true` (terminales VPOS de tarjeta); el resto (`pago_movil`, `transferencia`, `cash`, `zelle`, etc.) existen solo para testing y NO se soportan como piernas de producción.

## Scope

### In Scope
- **(a) State model a array de piernas**: generalizar `giftCardLeg` singular a `legs: PaymentLeg[]` (método + monto + referencia/payment) en `saleMachine.ts`, manteniendo retrocompatibilidad con el caso ya shippeado (gift card = una pierna más).
- **(b) VPOS como pierna intermedia**: tras cobro exitoso, si `remainingAmount > 0`, volver a `selectingMethod` en vez de cerrar la venta — generalizando el patrón `GIFT_CARD_PARTIAL` de `saleMachine.ts` al flujo VPOS (`useVposCheckout.ts`).
- **(c) Re-seleccionar el mismo método VPOS**: `PaymentSelect.tsx` debe permitir elegir el mismo método/journal más de una vez (dos tarjetas físicas distintas pueden compartir `x.pos.payment.method`).
- **(d) `printer_code` real**: fetch desde Odoo (`paymentMethodRepository.ts`, `types.ts`) y uso en `printPayload.ts` reemplazando el ternario hardcodeado `method.id === -999 ? '15' : '01'`, con acumulación defensiva por código (anti-colisión).
- **(e) IGTF real por pierna** vía `calcIgtf(method, legAmount)`, no forzado a 0 (en este negocio da 0, queda correcto a futuro).

### Out of Scope
- Backend Odoo: `_action_create_payments_from_pos` ya itera N pagos genéricamente (confirmado en explore.md).
- Soporte de producción para `pago_movil`/`transferencia`/`cash`/`zelle`/`crypto`/`biopago`/`banplus`/`otro` como piernas: son solo testing.
- N ilimitado de piernas: se aplica un **cap configurable** (default sugerido 3-4, decisión de diseño, no bloqueante).
- Paridad backend v16 (`eu_fex_integration`).
- `@api.constrains` de `printer_code` en Odoo (fix de datos recomendable, fuera del frontend).

## Capabilities

### New Capabilities
- `generic-partial-payment`: gift card opcional + N cobros VPOS sucesivos; estado `legs[]`; loop-back a `selectingMethod` mientras `remainingAmount > 0`; re-selección del mismo método VPOS; cap configurable de piernas.
- `fiscal-tender-code-mapping`: `printer_code` real por método VPOS; acumulación por código; bloqueo de métodos con código vacío.

### Modified Capabilities
- `gift-card-partial-payment`: **generalizado** — la gift card pasa a ser una pierna más entre varias; se elimina el límite de 2 piernas y el `montoIgtf:0` forzado del remainder.
- `payment-flow`: cobro VPOS puede ser pierna intermedia (loop-back si hay remanente); re-selección de método VPOS permitida; filtrado de métodos sin `printerCode`.

## Approach

Refactor mecánico incremental sobre la base de `gift-card-partial-payment`:
1. **Bajo riesgo primero**: traer `printer_code` y blindar `printPayload.ts` (acumular por código) — corrige bug fiscal que existe HOY en toda venta.
2. **Estado**: migrar singular → `legs[]`, con la gift card como primera pierna opcional; adaptar `saleOrderPayload.ts`.
3. **Loop VPOS**: generalizar el evento tipo `GIFT_CARD_PARTIAL` para que un cobro VPOS exitoso con remanente vuelva a `selectingMethod` en vez de cerrar; solo cierra cuando `remainingAmount === 0`.
4. **UI**: permitir re-seleccionar el mismo método VPOS y mostrar piernas acumuladas + remanente.
5. **IGTF**: `calcIgtf(method, legAmount)` por pierna.

El monto pedido al terminal ya es el remanente correcto (`effectiveTotal = context.remainingAmount ?? total`, `PaymentForm.tsx:34-40`) — no requiere cambio.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `saleMachine.ts` | Modified | `legs[]` reemplaza estado singular; loop-back genérico con remanente; cap de piernas |
| `useVposCheckout.ts` | Modified | Cobro exitoso con remanente → pierna intermedia (no cerrar venta) |
| `PaymentSelect.tsx` | Modified | Re-selección de método VPOS; render de piernas + remanente; filtro sin `printerCode` |
| `saleOrderPayload.ts` | Modified | Payload N piernas; IGTF per-leg |
| `paymentMethodRepository.ts` | Modified | `printer_code` en `search_read` + mapeo |
| `types.ts` | Modified | `printerCode?: string` en `KioskPaymentMethod`; tipo `PaymentLeg` |
| `printPayload.ts` | Modified | `printerCode` real + acumular por código + política de código vacío |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cambio de impresión fiscal (`printer_code` real vs `'01'` hardcodeado) afecta TODAS las ventas, no solo las partidas | High | GATE: validar en impresora fiscal real antes de producción (mismo gate que T4.2 del change anterior); NO asumir no-op |
| Reintento VPOS a mitad de venta multi-pierna (timeout/rechazo del terminal) pierde piernas ya cobradas | High | El fallo de un cobro VPOS DEBE dejar `remainingAmount` y `legs[]` ya cobradas intactos, permitiendo reintentar sin perder progreso — requisito explícito de spec/diseño |
| `printer_code` vacío para un método VPOS activo | Med | Política explícita: bloquear ese método del split con mensaje claro; sin fallback silencioso |
| Dos métodos comparten `printer_code` | Med | Acumular por código (fix P0, independiente del alcance) |
| Cap de piernas mal elegido para UX de kiosco | Low | Default configurable (3-4); estado soporta N sin cambios |

## Rollback Plan

Cambios aislados en frontend, sin migración de datos ni cambios de backend. Revertir = revert del commit/PR. Recomendado feature-flag para el loop N-piernas VPOS: si el gate fiscal no está validado, el fix de `printer_code` puede quedar activo mientras el split multi-VPOS se apaga.

## Dependencies

- Audit de datos: `SELECT id, name, payment_type, printer_code, with_merchant FROM x_pos_payment_method WHERE active AND use_for_payment` para confirmar qué terminales VPOS tienen código poblado.
- Sign-off del equipo que opera la impresora fiscal sobre el cambio de tender code.

## Success Criteria

- [ ] Una venta se cierra con gift card (opcional) + 2+ cobros VPOS sucesivos (mismo terminal repetido o distintos) hasta cubrir el total.
- [ ] Un cobro VPOS exitoso con remanente vuelve a selección de método, no cierra la venta; solo cierra cuando `remainingAmount === 0`.
- [ ] Un cobro VPOS fallido/timeout preserva las piernas ya cobradas y el remanente; el usuario puede reintentar.
- [ ] El mismo método VPOS puede seleccionarse más de una vez.
- [ ] Cada pierna imprime su línea de tender con su `printer_code` real; suma de piernas = total; IGTF por pierna = `calcIgtf(method, legAmount)`.
- [ ] Métodos con `printer_code` vacío quedan bloqueados con mensaje claro; códigos duplicados se acumulan, no se sobreescriben.
- [ ] Regresión: venta de un solo método VPOS y gift-card full-balance siguen funcionando.

## Open Questions

- **Cap de piernas simultáneas**: default sugerido 3-4 en un kiosco de autoservicio; decisión de diseño, no bloqueante. El state model soporta N sin cambios.
- **Confirmación de reintento VPOS**: definir en diseño el modelo exacto de estados para reintento (¿vuelve a `selectingMethod` o a un estado `retryLeg` dedicado?) preservando `legs[]`.
