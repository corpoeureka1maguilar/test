# Feature: Advanced (Menú de Administración Avanzada)

La feature `advanced` agrupa todas las herramientas administrativas, de diagnóstico y de control de sesión del Kiosco de Autopago. El acceso a estas vistas o acciones críticas está restringido bajo la autorización de un **PIN de Administrador**.

## Módulos y Pestañas del Menú

El componente principal **[AdvancedMenu.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/pages/AdvancedMenu.tsx)** expone las siguientes pestañas:

1. **Devoluciones (`devoluciones`)**:
   * Permite buscar facturas y órdenes anteriores.
   * Devolución **parcial por línea**: cada línea tiene checkbox + stepper de cantidad, topeado a lo que queda disponible (`product_uom_qty - x_return_quantity`, no la cantidad original del pedido) para no poder devolver dos veces la misma unidad. La columna "Devuelto" muestra cuánto ya se devolvió de esa línea.
   * Procesa la anulación/devolución en Odoo y emite la nota de crédito correspondiente mediante la impresora fiscal.
   * `returnOrder()` (en `saleRepository.ts`) hace dos llamadas a Odoo: `action_return_order_total` (factura + picking inverso) y, después, `action_set_returned_quantity_to_lines` (actualiza `x_return_quantity` en las líneas). Son independientes — si la segunda no se llama o falla, la devolución queda hecha en Odoo pero el sistema no se entera de cuánto se devolvió.
2. **Reimpresiones (`reimpresion`)**:
   * Búsqueda e impresión de copias de facturas fiscales emitidas previamente.
3. **Cierres de Sesión (`cierres`)**:
   * Control de apertura y cierre de la sesión de Punto de Venta (POS) en Odoo.
   * Envía comandos para emitir Reportes X y Reportes Z en la impresora fiscal.
4. **Parámetros del Terminal (`terminal`)**:
   * Inspección y edición de configuraciones de hardware y estación de trabajo.
5. **Métricas (`metricas`)**:
   * Visualización del rendimiento del kiosco, conteo de transacciones exitosas, errores y tiempos de respuesta.
6. **Cola Fuera de Línea (`offlineQueue`)**:
   * Monitoreo de transacciones almacenadas localmente durante caídas de red.
   * Permite forzar el reintento de sincronización con Odoo o descartar transacciones huérfanas.

## Componentes UI del Menú Avanzado

* **[AdvancedTabs.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/components/AdvancedTabs.tsx)**:
  Barra de navegación horizontal por pestañas que permite alternar entre los seis módulos administrativos (`devoluciones`, `reimpresion`, `cierres`, `terminal`, `metrics`, `cola`). Expone el tipo `AdvancedTab` y gestiona las clases CSS de selección activa.
* **[OrderSearchList.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/components/OrderSearchList.tsx)**:
  Componente de búsqueda y listado de órdenes. Renderiza un campo de texto de filtrado (`pattern`, `onPatternChange`), estado de carga (`isFetching`) y la lista de órdenes resultantes (`results: KioskOrder[]`) formateando totales en Bs y USD según la tasa (`rate`).
* **[ReturnsTab.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/components/ReturnsTab.tsx)**:
  Vista de la pestaña de devoluciones. Alterna entre la búsqueda de la orden a devolver mediante `OrderSearchList` y la vista de confirmación con `AppOrderSummary`, selector de motivo (`averia` o `producto`) y botones de acción.
* **[ReprintTab.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/components/ReprintTab.tsx)**:
  Vista de la pestaña de reimpresión de facturas. Muestra el buscador de órdenes o el detalle de la orden seleccionada (`AppOrderSummary`), notificando si posee número de factura fiscal o se reimprimirá como copia no fiscal.
* **[SessionTab.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/components/SessionTab.tsx)**:
  Vista de control de la sesión de Punto de Venta (POS). Visualiza el estado de la sesión (`opened`, `closed`, `checking`), estación, cajero activo e ID de sesión, y ofrece botones para aperturar/cerrar caja y emitir reportes fiscales X (Turno / Caja) y Z (Reporte Z diario).
* **[TerminalTab.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/components/TerminalTab.tsx)**:
  Vista de parámetros del terminal. Presenta el formulario `TerminalConfigForm` (servidor/DB de Odoo, usuario, contraseña, URL y modelo de impresora) en modo bloqueado por defecto hasta ser desbloqueado con PIN, además de la opción de recargar la caché local de productos y métodos de pago.
* **[MetricsTab.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/components/MetricsTab.tsx)**:
  Panel de control de métricas de uso y volumen de ventas (`AutopayMetrics`). Presenta tarjetas de KPI (Ventas Totales, Ticket Promedio, Transacciones, Devoluciones, Tiempo Muerto/Standby), desglose de uso por pantalla con barras proporcionales, métodos de pago utilizados, ranking de productos más vendidos y acción para restablecer métricas.
* **[OfflineQueueTab.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/components/OfflineQueueTab.tsx)**:
  Vista de gestión de ventas pendientes offline (`QueueEntry[]`). Muestra la lista de transacciones encoladas con su estado (`PENDIENTE`, `SINCRONIZANDO`, `FALLIDA`), fecha de encolado, intentos y último error, ofreciendo acciones de reintento y descarte para transacciones fallidas.

## Hooks de Operaciones Administrativas

* **[useAdminPinAction.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/hooks/useAdminPinAction.ts)**:
  Manejador de seguridad que interrumpe una acción para solicitar el PIN administrativo mediante el modal `AppPinModal`. Exporta la interfaz **[PendingAdminAction](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/hooks/useAdminPinAction.ts#L6-L11)** (`title`, `operationRef`, `auditMessage`, `run`) para estructurar las acciones que requieren autorización previa.
* **[useOrderReturn.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/hooks/useOrderReturn.ts)**:
  Gestiona el flujo de devolución de una orden seleccionada en Odoo, validando los motivos de devolución y actualizando el stock. Usa `useReturnLineSelection` para la selección parcial por línea antes de llamar a `returnOrder()`.
* **[useReturnLineSelection.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/hooks/useReturnLineSelection.ts)**:
  Maneja la selección de líneas a devolver (checkbox + cantidad por línea). Por defecto selecciona todo lo que queda disponible de cada línea (no lo ya devuelto), y clampea cualquier cantidad ingresada a ese disponible.
* **[useOrderSearch.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/hooks/useOrderSearch.ts)** & **[useSearchOrders.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/hooks/useSearchOrders.ts)**:
  Hooks de consulta para buscar facturas en Odoo a través del número fiscal o ID.
* **[useSessionControls.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/hooks/useSessionControls.ts)**:
  Controla los comandos JSON-RPC para abrir, cerrar y auditar la sesión activa del cajero automático.
* **[useOfflineQueue.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/hooks/useOfflineQueue.ts)**:
  Interactúa con la base de datos local (Zustand persistido o IndexedDB) que retiene las transacciones pendientes cuando el kiosco trabaja en modo offline.
* **[useAdvancedMetrics.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/hooks/useAdvancedMetrics.ts)**:
  Gestiona la lectura y actualización de las métricas del kiosco (`getMetrics`). Relee los datos al enfocar la pestaña de métricas y proporciona la función `handleResetMetrics` que requiere autorización de PIN administrativo (`terminalConfig`).
* **[useExchangeRateSync.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/hooks/useExchangeRateSync.ts)**:
  Sincroniza la tasa de cambio de divisas desde Odoo (`fetchExchangeRate`) cuando la conexión está lista (`isConnectionReady`), manteniendo la última tasa conocida en caso de fallo de red.
* **[useFiscalReports.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/hooks/useFiscalReports.ts)**:
  Maneja el envío de comandos de impresión de reportes fiscales (Reportes X y Z) a través de `FiscalPrinterAdapter`, solicitando previa validación de PIN administrativo.
* **[useOrderReprint.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/hooks/useOrderReprint.ts)**:
  Controla la reimpresión de órdenes. Si la orden contiene número fiscal (`printerNumber`) solicita la reimpresión fiscal desde la memoria de la impresora (`PrintReimpresion`), y si no lo posee imprime una copia de comprobante no fiscal estructurada (`buildNoFiscalReceipt`). Exige confirmación de PIN.
* **[useTerminalConfig.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/advanced/hooks/useTerminalConfig.ts)**:
  Maneja el estado del formulario de configuración de la terminal (`TerminalConfigForm`), el estado de desbloqueo de edición (`isTerminalUnlocked`) con PIN de administrador y la recarga de datos en caché para productos y métodos de pago (`queryClient.refetchQueries`).
