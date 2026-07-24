# Exploración — Pago parcial con Tarjeta de Regalo

## Objetivo

Hoy el pago con tarjeta de regalo en el kiosko de autopago **exige que el saldo de la tarjeta cubra el total completo** de la orden. Si el saldo es menor, bloquea el pago y solo ofrece "Usar otra tarjeta". El negocio quiere permitir **pago parcial**: consumir el saldo completo de la gift card y cobrar el **monto restante** con otro método de pago, en la misma venta.

## Pregunta crítica y respuesta

**¿El backend de autopago (Odoo) soporta una orden con pago combinado (gift card parcial + otro método), o hay que implementarlo también en el backend?**

**Respuesta: el backend v19 (`eu_agroo_fex_integration_v19`) YA lo soporta, sin cambios de esquema ni de reconciliación.** El bloqueo es 100% del frontend.

Evidencia:
- `eu_agroo_fex_integration_v19/eu_pos_gift_card/models/models.py:59-62` — `AccountMove.action_fex_reconcile()` llama primero a `super()` (reconcilia todos los `x_payment_ids`/`x_payment_fex_ids`), y **solo si queda `amount_residual > 0`** llama a `pay_with_gift_card()` para cubrir el resto con el `giftCard.amount` que mandó el frontend. Es un patrón de "relleno de residual" que soporta consumo parcial de la gift card de forma inherente.
- `eu_agroo_fex_integration_v19/eu_pos_gift_card/models/x_pos_gift_card.py:36-40` — `balance` es computado (`value - sum(facturas posteadas)`), no hay restricción de "hay que consumir todo"; `state` pasa a `consumed` solo cuando `balance <= 0`. `action_pay` (línea 102) acepta un monto arbitrario.

El motivo por el que el backend nunca ve la segunda pierna de pago hoy:
- `eu_fex_autopay/src/shared/lib/saleOrderPayload.ts:37,91` — fuerza `payments: []` siempre que `method.id === -999` (gift card).
- `eu_fex_autopay/src/features/payment/hooks/useGiftCardPayment.ts:26,56-59` — bloquea el submit cuando `balance < total`.

## Áreas afectadas (frontend)

| Archivo | Cambio |
|---|---|
| `useGiftCardPayment.ts` | Quitar el bloqueo duro; calcular `consumedAmount = min(balance, total)` y `remainingAmount = total - consumedAmount`. |
| `saleMachine.ts` | El context modela un solo `activePayment`/`selectedMethod`. Necesita un concepto de "remanente". **Recomendado: NO un split genérico de N métodos, sino extender para exactamente 2 piernas: gift card + un método más.** |
| `saleOrderPayload.ts:91` | Cuando hay pago parcial, mandar `payments[]` NO vacío (pierna del remanente) **y** `giftCard.amount = consumedAmount` (no el total). |
| `printPayload.ts:116-157` (`buildFacturaPayload`) | **Limitación dura de un solo medio de pago** — hoy escribe una sola clave `pagoXX`. Necesita soporte multi-pierna para impresión fiscal split-tender. |
| Backend (menor, no bloqueante): `eu_pos_base/models/sale_order.py` `_compute_x_amounts` | No incluye el residual pagado con gift card en `x_amount_paid` (solo suma registros de pago, no el asiento de gift card). Follow-up, no bloquea. |

## Enfoques

**Enfoque 1 (recomendado): concepto de "remanente" con 2 piernas.**
Extender la máquina para manejar gift card (consumo parcial) + un método adicional que cubre el remanente. Coincide con el contrato de 2 piernas que ya tiene el backend. Evita sobre-ingeniería.

**Enfoque 2 (descartado por ahora): array de split-payment genérico N-way.**
Más flexible pero especulativo — el backend y el negocio hoy solo piden 2 piernas. Complejidad no justificada.

## Riesgos y preguntas abiertas

1. **Impresión fiscal multi-tender (mayor riesgo):** `buildFacturaPayload` es de un solo medio de pago. Falta confirmar que la impresora fiscal soporta split-tender por firmware/hardware **antes** de comprometer el diseño.
2. **IGTF sobre el remanente:** el IGTF debe recalcularse sobre el **remanente solamente**, no sobre el total, si el segundo método aplica IGTF. Necesita sign-off explícito de negocio/fiscal.
3. **Backend v16 (`eu_fex_integration`, "por implementar"):** NO fue verificado en profundidad — solo se leyó v19. Hay que diferenciarlo antes de asumir paridad.
4. **Cola offline (`orderQueue.ts`):** persiste el output de `buildSaleOrderPayload()` verbatim, así que una vez que el builder soporte 2 piernas, el replay offline funciona "gratis".

## Estado

Listo para `sdd-propose`, con dos preguntas abiertas marcadas (impresión fiscal multi-tender, fórmula de IGTF sobre remanente).
