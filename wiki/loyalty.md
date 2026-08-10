# Feature: Loyalty (Fidelización de Clientes)

La feature `loyalty` intercepta el flujo de checkout cuando ciertos productos o promociones en el carrito requieren el escaneo o registro de una tarjeta de fidelización (Loyalty Card).

## Flujo de Validación de Lealtad

1. **Requerimiento**: Al avanzar desde la revisión del carrito, la máquina de estados verifica si el contenido del carrito tiene reglas de lealtad activas (motores de fidelización definidos).
2. **Intercepción**: Si se requiere, transiciona al estado `loyaltyRequired`, redirigiendo al cliente a la página `LoyaltyCheck`.
3. **Escaneo/Ingreso**: El usuario escanea su tarjeta física o ingresa el código.
4. **Verificación en Odoo**:
   * Si la tarjeta existe y está asociada al cliente, se vincula a la venta.
   * Si es una tarjeta nueva, se solicita su registro asociándolo al cliente actual en el Kiosco.

## Páginas y Componentes

* **[LoyaltyCheck.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/loyalty/pages/LoyaltyCheck.tsx)**:
  Pantalla que maneja la lógica de escaneo.
  * Utiliza un enfoque dinámico para derivar máscaras de entrada a partir de expresiones regulares configuradas en los motores de lealtad en Odoo (`deriveInputMask`).
  * Valida en tiempo real la estructura del código ingresado mediante `formatWithMask`.
  * Si la validación pasa, llama a la API de Odoo para vincular la tarjeta.
* **[useLoyalty.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/loyalty/hooks/useLoyalty.ts)**:
  Contiene la mutación `useRegisterLoyaltyCard` para registrar la tarjeta de fidelización mediante la función `registerLoyaltyCard` en el repositorio compartido.
