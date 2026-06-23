# eu_fex_autopay

Kiosco de autopago para FEX (Facturación Express). El cliente se factura a sí mismo sin necesidad de un cajero: busca su cédula, elige productos, paga y recibe su factura fiscal impresa.

Forma parte del ecosistema FEX junto con `eu_fex_ppal` (POS de cajero) y el módulo Odoo `eu_pos_base`.

---

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 18 + TypeScript + SCSS |
| Estado de flujo | XState v5 (máquina de estados) |
| Estado global | Zustand v5 |
| Fetching / mutaciones | TanStack Query v5 |
| Routing | React Router 6 |
| Build | Vite 5 |
| Servidor de producción | Node.js (`server.js`) |
| Wrapper de escritorio | Electrobun (`fex_wrapper/`) |
| Backend | Odoo 19 via JSON-RPC |

---

## Flujo de venta

```
Inicio
  └─ Ingresá tu cédula
       ├─ Cliente encontrado → Catálogo de productos
       └─ Cliente nuevo → Registro → Catálogo de productos
                                          └─ Carrito
                                               └─ Elegí cómo pagar
                                                    └─ Ingresá referencia
                                                         └─ Procesando pago (Odoo)
                                                              └─ Impresión fiscal
                                                                   └─ Confirmación (10s → inicio)
```

Devoluciones disponibles desde la pantalla de inicio con PIN de administrador.

---

## Arquitectura

### Máquina de estados (`src/machines/saleMachine.ts`)

El flujo completo de venta está modelado en XState. Estados principales:

`idle` → `enteringCedula` → `browsingProducts` → `reviewingCart` → `selectingMethod` → `enteringDetails` → `processing` → `printing` → `success`

Cada transición es explícita. No hay estados inválidos posibles.

### Proxy dinámico

La app no puede conectarse directamente a Odoo desde el browser (CORS). El proxy se configura en runtime cuando el usuario guarda la URL de Odoo en `/setup`:

- **Dev**: plugin de Vite en `vite.config.ts` — endpoint `POST /__odoo-proxy-target`
- **Prod**: `server.js` — mismo endpoint, sirve también los archivos estáticos de `dist/`

### Impresora fiscal

Se comunica con el servidor HTTP local de la impresora (`ServWebImpresion/api/`). La URL se configura en `/setup`. El `FiscalPrinterAdapter` en `src/lib/fiscalPrinter.ts` es una adaptación del mismo adaptador de `eu_fex_ppal` sin dependencias de Electron.

---

## Estructura

```
src/
├── machines/           # XState: saleMachine + SaleMachineContext
├── lib/                # odooEnv, fiscalPrinter, printPayload, paymentUtils, saleOrderPayload
├── stores/             # Zustand: config (persistido), ui, cart
├── hooks/              # TanStack Query: partner, products, payment methods
├── pages/              # Una página por estado de la máquina
├── components/         # AppPinModal, AppNumericKeyboard, AppOrderSummary, etc.
├── types/              # Tipos TypeScript compartidos
└── assets/             # SCSS base + fuente Outfit
server.js               # Servidor de producción (static + proxy)
```

---

## Configuración

Al abrir la app por primera vez redirige a `/setup`. Campos requeridos:

| Campo | Descripción |
|---|---|
| URL de Odoo | `https://mi-odoo.empresa.com` |
| Base de datos | Nombre de la BD de Odoo |
| Usuario de servicio | Email del usuario con permisos de POS |
| Contraseña | Contraseña del usuario |
| URL impresora fiscal | `http://127.0.0.1/ServWebImpresion/api/` |
| PIN de administrador | 4–6 dígitos. Protege devoluciones y acceso a configuración |

La configuración se guarda en `localStorage`. El PIN se almacena como hash SHA-256.

---

## Desarrollo

```bash
npm install
npm run dev         # Vite dev server en localhost:5173
```

El proxy dinámico funciona solo en `dev`. Al guardar la configuración, la app llama a `POST /__odoo-proxy-target` con la URL de Odoo — sin necesidad de `.env`.

---

## Producción / Kiosco

```bash
npm run build       # Genera dist/
npm run preview     # Levanta server.js en localhost:4173
```

`server.js` hace tres cosas:
1. Sirve los archivos de `dist/` (SPA con fallback a `index.html`)
2. Expone `POST /__odoo-proxy-target` para configurar el destino del proxy
3. Proxea `/jsonrpc` y `/web` hacia Odoo

### Wrapper de escritorio

`fex_wrapper/` es una app Electrobun que abre el kiosco a pantalla completa. Requiere que `server.js` esté corriendo antes de abrirlo.

```bash
# Terminal 1
cd eu_fex_autopay && npm run preview

# Terminal 2
cd fex_wrapper && bun run dev
```

Para apuntar a un servidor distinto:
```bash
AUTOPAY_URL=http://192.168.1.10:4173 bun run dev
```

---

## Despliegue en Vercel

Al desplegar en Vercel, el enrutamiento está configurado en [vercel.json](file:///c:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/vercel.json) para redirigir las peticiones `/jsonrpc`, `/web` y `/printer-proxy` a una función Serverless que actúa como proxy (`/api/proxy`).

Es necesario configurar las siguientes variables de entorno en la consola de Vercel:

| Variable | Valor Recomendado | Descripción |
|---|---|---|
| `VITE_PRINTER_PROXY_BASE` | `http://localhost:9191` | **Requerido para imprimir**. Es la base de la URL para el proxy de la impresora fiscal. Redirige las peticiones seguras de Vercel (HTTPS) hacia el agente de impresión local HTTP de la PC del cajero. |
| `VITE_PROXY_BASE` | *(Dejar vacío)* | Base de la URL para el proxy de Odoo. Si se deja vacío, las peticiones se realizan de forma relativa usando el propio dominio de la SPA en Vercel. |
| `VITE_ODOO_TARGET` | *(Opcional)* | URL de fallback del servidor de Odoo (ej. `https://latinbien-test.agroo.net.ve`) en caso de que no se especifique dinámicamente. |

---

## Dependencias de Odoo

- Módulo: `eu_pos_base` (parte de `eu_agroo_fex_integration_v19`)
- Método principal: `sale.order.action_create_sale_order_from_pos`
- Los pagos se procesan vía `queue_job` (asíncrono). El worker de Odoo debe estar corriendo.
- Los productos deben tener **política de facturación = "Cantidades ordenadas"** para aparecer en el catálogo.

---

## Notas importantes

- **Tasa de cambio**: actualmente hardcodeada en `1`. Pendiente obtenerla dinámicamente de Odoo.
- **IGTF**: deshabilitado por ahora (`montoIgtf: 0`).
- **Sin sesión POS**: la app no usa sesión ni estación. Los pagos no generan transacciones de caja.
