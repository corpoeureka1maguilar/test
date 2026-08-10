# Feature: Cart (Carrito de Compras)

La feature `cart` maneja el estado local de los productos agregados por el cliente, calcula los montos totales (subtotales, impuestos, exentos) y proporciona la pantalla de revisión antes del pago.

## Zustand Store: `cart.ts`

El estado del carrito está centralizado en el store de Zustand **[cart.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/cart/stores/cart.ts)** a través de la función exportada **[useCartStore](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/cart/stores/cart.ts#L21)**.

### Acciones del Store
* `addItem(product)`: Agrega o incrementa la cantidad de un producto.
* `addGiftCard(product, amount)`: Reemplaza los ítems del carrito por una tarjeta de regalo con el monto especificado.
* `removeItem(productId)`: Elimina por completo un ítem del carrito.
* `setQty(productId, qty)`: Modifica la cantidad directamente de un producto determinado.
* `clearCart()`: Limpia todos los ítems y reinicia el carrito.

### Hooks Selectoras y Tipos Exportados
* **[useCartSubtotal](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/cart/stores/cart.ts#L98-L103)**: Hook selector que calcula y retorna el subtotal acumulado del carrito en Bs.
* **[useCartTotal](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/cart/stores/cart.ts#L105-L113)**: Hook selector que calcula y retorna el total general a pagar con impuestos incluidos en Bs.
* **[useCartTaxTotal](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/cart/stores/cart.ts#L115-L123)**: Hook selector que calcula y retorna el monto total acumulado de impuestos (IVA) en Bs.
* **[CartTaxBreakdownItem](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/cart/stores/cart.ts#L125-L129)**: Interfaz exportada que define la estructura del desglose de impuestos (`rate`, `label`, `amount`).
* **[useCartTaxBreakdown](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/cart/stores/cart.ts#L131-L161)**: Hook selector que agrupa los ítems por tasa tributaria y calcula el desglose de IVA por tramos (`CartTaxBreakdownItem[]`).
* **[useCartCount](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/cart/stores/cart.ts#L163-L165)**: Hook selector que retorna la cantidad total acumulada de unidades de productos en el carrito.

## Componentes y Páginas

* **[CartReview.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/cart/pages/CartReview.tsx)**:
  Pantalla de revisión intermedia. Muestra una lista detallada de los ítems en el carrito, permitiendo ajustar cantidades o eliminar productos. Ofrece dos llamadas a la acción principales:
  * "Agregar más productos" (retorna al catálogo).
  * "Proceder al pago" (avanza a la selección de pago).
* **[AppOrderSummary.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/cart/components/AppOrderSummary.tsx)**:
  Desglose numérico de la orden. Es reutilizado tanto en la revisión del carrito como en la pantalla de pago para mostrar transparencia al cliente sobre lo que se le está cobrando.
* **[AppStepper.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/cart/components/AppStepper.tsx)**:
  Indicador de progreso en la parte superior de la pantalla que guía visualmente al cliente a lo largo de su compra.

## Hooks Clave

* **[useOrder.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/cart/hooks/useOrder.ts)**:
  Hook de consulta basado en TanStack Query (`useQuery`) para obtener los detalles de una orden de venta registrada en Odoo mediante su ID (`fetchOrder`).
