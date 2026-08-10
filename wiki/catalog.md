# Feature: Catalog (Catálogo de Productos)

La feature `catalog` gestiona la visualización, filtrado y selección de productos que el usuario desea comprar. Proporciona una interfaz visual táctil e integra capacidades de lectura de código de barras por hardware.

## Funcionalidades Principales

1. **Navegación Táctil**: Cuadrícula de productos organizada por categorías.
2. **Búsqueda Manual**: Modal de búsqueda que despliega un teclado QWERTY en pantalla para ingresar texto.
3. **Escaneo de Código de Barras**: Escuchador activo global que captura las lecturas de una pistola lectora emulada por teclado para agregar productos directamente al carrito.
4. **Tarjetas de Regalo (Gift Cards)**: Detección y manejo de montos personalizados al seleccionar una tarjeta de regalo.

## Componentes y Páginas

* **[ProductCatalog.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/pages/ProductCatalog.tsx)**:
  Contenedor principal del catálogo. Coordina la barra lateral del carrito (`CartSidebar`), el buscador y la cuadrícula.
* **[ProductGrid.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/components/ProductGrid.tsx)**:
  Renderiza las tarjetas de productos (`ProductCard`) filtradas por la categoría o término de búsqueda seleccionado.
* **[ProductCard.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/components/ProductCard.tsx)**:
  Tarjeta individual de producto en la cuadrícula de catálogo. Muestra el código por defecto, nombre del producto, indicación de exención de IVA `(E)`, precio en Bs. y USD, y controles táctiles para agregar o modificar la cantidad.
* **[CartSidebar.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/components/CartSidebar.tsx)**:
  Barra lateral integrada del carrito de compras en el catálogo. Despliega la lista de productos seleccionados (`CartItemRow`), el desglose de subtotal, impuestos y total general en Bs. y USD, con acciones para cancelar o avanzar al pago ("PAGAR AHORA").
* **[CartItemRow.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/components/CartItemRow.tsx)**:
  Fila individual de un ítem en el carrito lateral. Incluye el nombre, indicador exento `(E)`, precio unitario, controles táctiles de incremento/decremento (`+`/`-`), botón de eliminación e importes calculados en Bs. y USD.
* **[ManualSearchModal.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/components/ManualSearchModal.tsx)**:
  Modal de búsqueda con teclado táctil virtual.
* **[GiftCardAmountModal.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/components/GiftCardAmountModal.tsx)**:
  Modal emergente para ingresar el monto deseado en USD al adquirir una tarjeta de regalo, equipado con teclado numérico en pantalla (`AppNumericKeyboard`).
* **[MobileCheckoutBar.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/components/MobileCheckoutBar.tsx)**:
  Barra fija de checkout para dispositivos móviles (`md:hidden`) que resume la cantidad de ítems, el monto total en Bs./USD y acceso directo al pago.
* **[NotFoundToast.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/components/NotFoundToast.tsx)**:
  Notificación flotante temporal de advertencia desplegada cuando un código de producto o código de barras no existe en el catálogo.
* **[HiddenScannerInput.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/components/HiddenScannerInput.tsx)** & **[ScannerPanel.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/components/ScannerPanel.tsx)**:
  Asegura que el foco del lector de código de barras se mantenga activo en segundo plano sin entorpecer la interacción del usuario.

## Hooks de Negocio

* **[useProducts.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/hooks/useProducts.ts)**:
  Obtiene la lista de productos y categorías de Odoo usando React Query.
* **[useBarcodeScanner.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/hooks/useBarcodeScanner.ts)**:
  Captura las pulsaciones rápidas del lector de código de barras, acumulando los caracteres hasta detectar un salto de línea (Enter), buscando el código en la base de datos de productos y disparando la adición en el carrito.
* **[useProductFilters.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/hooks/useProductFilters.ts)**:
  Gestiona los filtros del catálogo por categoría activa y búsqueda textual. Exporta la interfaz **[ProductCategory](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/hooks/useProductFilters.ts#L5-L8)** (`id`, `name`) para la estructura de categorías de productos.
* **[useCatalogCart.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/hooks/useCatalogCart.ts)**:
  Maneja la interacción entre el catálogo y el store del carrito. Incluye adición de productos, restricción de exclusividad y modal de tarjeta de regalo, auto-adición de productos fijos configurados, animación visual ("bounce") y consulta de cantidades.
* **[useProductNotFoundAlert.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/hooks/useProductNotFoundAlert.ts)**:
  Administra el estado y descartado automático (tras 2.5 segundos) de la alerta de producto no encontrado.
* **[useProductSearch.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/catalog/hooks/useProductSearch.ts)**:
  Ejecuta búsquedas online-first en Odoo mediante TanStack Query para obtener coincidencias en el catálogo completo por nombre, código o código de barras, con fallback al filtro local offline.
