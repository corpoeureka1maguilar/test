# Feature: Customer (Identificación y Registro)

La feature `customer` gestiona la identificación del comprador en el sistema. Es obligatoria para poder avanzar al catálogo de productos, ya que toda venta debe asociarse a un cliente en Odoo para efectos de facturación fiscal.

## Flujo del Proceso

```
[ Welcome ] ──► [ CustomerIdentity ] ──► Buscar Cédula/RIF en Odoo
                       │
                       ├─(Existe)──────► [ Catalog ]
                       │
                       └─(No Existe)───► [ CustomerRegister ] ──► Crear Cliente en Odoo ──► [ Catalog ]
```

## Componentes y Páginas

* **[CustomerIdentity.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/customer/pages/CustomerIdentity.tsx)**:
  Pantalla que solicita la Cédula o RIF del cliente. Cuenta con un teclado numérico táctil en pantalla optimizado para kioscos.
* **[CustomerRegister.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/customer/pages/CustomerRegister.tsx)**:
  Formulario para registrar nuevos clientes cuando el documento ingresado no se encuentra en el sistema. Solicita:
  * Nombre o Razón Social
  * Teléfono
  * Dirección (opcional)
  * Correo Electrónico (opcional)
* **[VenezuelanPhoneField.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/customer/components/VenezuelanPhoneField.tsx)**:
  Campo de entrada específico para teléfonos de Venezuela, aplicando validaciones de prefijo locales (0414, 0424, 0412, 0416, 0212, etc.).
* **[InternationalPhoneField.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/customer/components/InternationalPhoneField.tsx)**:
  Entrada para números de teléfono internacionales que no siguen el esquema venezolano.

## Hooks Clave

* **[usePartnerByCedula.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/customer/hooks/usePartnerByCedula.ts)**:
  Consulta Odoo mediante JSON-RPC para verificar si existe un partner con el número de documento provisto.
* **[useCreatePartner.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/customer/hooks/useCreatePartner.ts)**:
  Mutación de TanStack Query para persistir un nuevo registro de cliente en la base de datos de Odoo.
* **[usePhoneInput.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/customer/hooks/usePhoneInput.ts)**:
  Maneja la máscara, validación y formateo dinámico en tiempo real del número telefónico.
* **[useAddressAutocomplete.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/customer/hooks/useAddressAutocomplete.ts)**:
  Ofrece autocompletado de direcciones geográficas mediante la API Photon de Komoot delimitada para Venezuela (`VE_BBOX`), aplicando debounce de 400ms y gestión de peticiones cancelables con `AbortController`. Exporta la interfaz **[AddressSuggestion](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/customer/hooks/useAddressAutocomplete.ts#L19-L24)** (`id`, `label`, `street`, `estado`) para los resultados sugeridos.
* **[useRegisterForm.ts](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/customer/hooks/useRegisterForm.ts)**:
  Controla el estado y la validación para el registro de clientes. Exporta el esquema Zod de validación **[registerSchema](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/customer/hooks/useRegisterForm.ts#L29)** y el tipo **[RegisterFormData](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/customer/hooks/useRegisterForm.ts#L31)** derivado del esquema (`makeRegisterSchema`). Integra la lógica de teléfono con `usePhoneInput`, auto-reset de formulario al cambiar de cliente, y manejo de selección de teclado o sugerencias de dirección.
