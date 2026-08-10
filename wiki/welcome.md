# Feature: Welcome (Inicio y Publicidad)

La feature `welcome` representa el estado inicial (`idle`) del Kiosco de Autopago. Su propósito principal es atraer al cliente e iniciar el flujo de compra.

## Componentes y Estructura

* **[Welcome.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/welcome/pages/Welcome.tsx)**:
  Página principal que se muestra cuando el kiosco está inactivo.
  * Muestra una invitación visual para comenzar ("Toca la pantalla para iniciar").
  * Renderiza el componente de publicidad `WelcomeAd`.
  * Contiene accesos discretos (por ejemplo, mediante patrones táctiles o combinación de botones) para acceder al **Menú Avanzado** de administración/devoluciones.
* **[WelcomeAd.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/welcome/components/WelcomeAd.tsx)**:
  Carrusel o visualizador de anuncios publicitarios activos.
* **[useAdvertisements.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/welcome/hooks/useAdvertisements.ts)**:
  Hook encargado de consultar las campañas y anuncios disponibles desde Odoo.

## Comportamiento del Estado `idle`

1. Cuando la aplicación se inicializa o finaliza una venta (luego del timeout de 10 segundos en la pantalla de éxito), la máquina de estados transiciona a `idle`.
2. Durante este estado, el carrito de compras y los datos del cliente activo se limpian por completo.
3. Se activa un ciclo de reproducción automática de los anuncios publicitarios en pantalla completa o sección principal.
