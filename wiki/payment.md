# Feature: Payment (Procesamiento de Pagos)

La feature `payment` es el núcleo transaccional del Kiosco de Autopago. Soporta múltiples métodos de pago, pagos parciales combinados (splits) en diferentes monedas (USD/VES) y controla todo el flujo de venta a través de la máquina de estados principal.

## Máquina de Estados Principal: `saleMachine.ts`

Toda la lógica secuencial y la navegación está gobernada por la máquina de estados definida en **[saleMachine.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/machines/saleMachine.ts)**.

Exporta las estructuras y tipos de datos principales del flujo transaccional:
* **[SaleContext](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/machines/saleMachine.ts#L68-L86)**: Interfaz que define la estructura del contexto de la venta (`customer`, `pendingVat`, `cart`, `requiredEngines`, `selectedMethod`, `activePayment`, `giftCard`, `giftCardLeg`, `remainingAmount`, `legs`, `saleAttemptId`, `odooOrderId`, `queuedOffline`, `printerResult`, `errorMessage`, `printError`, `countdown`).
* **[SaleEvent](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/machines/saleMachine.ts#L90-L107)**: Unión discriminada de los eventos transaccionales emitidos (`START`, `FOUND`, `NOT_FOUND`, `REGISTERED`, `CHECKOUT`, `LOYALTY_DONE`, `LOYALTY_SKIP`, `PAY`, `SELECT_METHOD`, `SUBMIT_PAYMENT`, `GIFT_CARD_PARTIAL`, `LEG_PAID`, `TICK`, `RETRY`, `CONTINUE`, `BACK`, `RESET`).

Los estados clave que gobierna son:
* `idle`: Esperando cliente.
* `enteringCedula` / `registering`: Búsqueda o registro de cliente.
* `browsingProducts`: Selección en el catálogo.
* `reviewingCart`: Revisión de ítems.
* `loyaltyRequired`: Validación de tarjetas de fidelización.
* `selectingMethod`: Pantalla para escoger cómo pagar.
* `enteringDetails`: Formulario de ingreso de datos según el método elegido.
* `processing`: Comunicación con Odoo para crear la orden de venta y validar el pago.
* `printing`: Envío del comando de impresión a la impresora fiscal local.
* `success` / `failure`: Pantallas finales con timeout o botón de reintento.

### Contexto de la Máquina de Estados

* **[SaleMachineContext.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/machines/SaleMachineContext.tsx)**:
  Proveedor de contexto React (`SaleMachineProvider`) que envuelve la ejecución de `saleMachine` utilizando `@xstate/react` (`useMachine`). Expone el hook `useSaleMachine()` para dar acceso global al estado actual (`state`), contexto de la venta (`context`), emisor de eventos (`send`) y verificador de estado activo (`matches`).

## Páginas del Flujo de Pago

* **[PaymentSelect.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/pages/PaymentSelect.tsx)**:
  Permite al usuario seleccionar el método de pago (Pago Móvil, Tarjeta de Crédito, VPOS, Tarjeta de Regalo, Efectivo). Permite configurar pagos divididos indicando cuánto pagar con el método actual.
* **[PaymentForm.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/pages/PaymentForm.tsx)**:
  Formulario dinámico que se adapta al método de pago seleccionado. Por ejemplo:
  * **Pago Móvil**: Solicita banco emisor, teléfono, fecha y número de referencia.
  * **VPOS**: Muestra el progreso de la transacción de tarjeta.
  * **Gift Card**: Entrada para escanear/digitar el código de barra de la tarjeta de regalo.
* **[PaymentResult.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/pages/PaymentResult.tsx)**:
  Muestra si la transacción finalizó con éxito o error, e inicia el proceso de impresión de la factura fiscal.

## Componentes y Vistas de Pago

* **[AppPaymentMethodCard.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/components/AppPaymentMethodCard.tsx)**:
  Tarjeta interactiva de selección de método de pago (`KioskPaymentMethod`). Asigna iconos dinámicos de `@phosphor-icons/react` según la modalidad de pago (`cash`, `pago_movil`, `card`, `zelle`, etc.) y muestra el indicador de recargo por IGTF cuando aplica.
* **[GiftCardPaymentView.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/components/GiftCardPaymentView.tsx)**:
  Vista de procesamiento de tarjetas de regalo. Permite la introducción y búsqueda de códigos con teclado virtual integrado (`AppVirtualKeyboard`), muestra saldos en USD/Bs, calcula montos a debitar y gestiona tanto consumos totales como parciales permitiendo abonar remanentes con un segundo método.
* **[PaymentDetailsForm.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/components/PaymentDetailsForm.tsx)**:
  Formulario modular de captura de datos de pago. Muestra de forma condicional los campos requeridos (`bank`, `phone`, `reference`), maneja la validación de entrada y expone botones para confirmar el pago o regresar.
* **[VposPaymentView.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/components/VposPaymentView.tsx)**:
  Vista para el procesamiento a través de terminales de punto de venta virtuales. Muestra un estado de verificación inicial (`checking`) y carga la pasarela interactiva de pago dentro de un `iframe` incrustado.
* **[LegAmountInput.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/components/LegAmountInput.tsx)**:
  Componente para ingresar montos de pago parcial (split) con soporte para conversión de divisas (tasa de cambio oficial del día).
* **[PaymentAmountSummary.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/components/PaymentAmountSummary.tsx)**:
  Muestra el total de la orden, los pagos ya registrados (abonos) y el balance pendiente por pagar.
* **[AppPinModal.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/components/AppPinModal.tsx)**:
  Modal de ingreso de PIN para autorizar acciones administrativas (como anulación de pagos o devoluciones).

## Hooks y Procesamiento

* **[usePaymentAmounts.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/hooks/usePaymentAmounts.ts)**:
  Calcula montos faltantes, tasas de cambio y sumas de pagos parciales.
* **[usePaymentMethods.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/hooks/usePaymentMethods.ts)**:
  Obtiene los métodos de pago habilitados para el kiosco desde Odoo.
* **[useVposCheckout.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/hooks/useVposCheckout.ts)**:
  Maneja la integración y estados transaccionales con terminales de punto de venta virtuales (VPOS).
* **[useGiftCardPayment.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/hooks/useGiftCardPayment.ts)**:
  Maneja la aplicación de saldo de tarjetas de regalo al total a pagar.
* **[usePaymentDetailsForm.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/hooks/usePaymentDetailsForm.ts)**:
  Maneja el estado del formulario de detalles de pago (`bank`, `phone`, `reference`), valida números telefónicos venezolanos (`isValidVenezuelanPhone`), y envía los eventos `SUBMIT_PAYMENT` o `LEG_PAID` a la máquina de estados regulando la navegación hacia la pantalla de resultado o pago adicional.
* **[usePaymentMethodGuard.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/payment/hooks/usePaymentMethodGuard.ts)**:
  Hook guardián de rutas que verifica la presencia de un método de pago activo seleccionado en el contexto de la máquina de estados; si no existe, redirige al usuario a la pantalla de selección `/pago`.
