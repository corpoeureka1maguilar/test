# Wiki de Features: eu_fex_autopay

Esta wiki documenta las funcionalidades y la arquitectura del sistema de Kiosco de Autopago. El sistema permite a los clientes realizar compras de forma autónoma, integrándose con **Odoo** para la gestión de datos y una **Impresora Fiscal** local para la emisión de facturas.

## Índice de Features

A continuación se detallan las wikis para cada feature ubicada en `src/features`:

1. [Welcome](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/wiki/welcome.md)
   * Pantalla de inicio, carrusel de anuncios y disparadores del flujo.
2. [Customer](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/wiki/customer.md)
   * Búsqueda de cliente por Cédula/RIF y registro de nuevos usuarios con soporte de máscaras telefónicas.
3. [Catalog](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/wiki/catalog.md)
   * Navegación de productos, búsqueda manual y escaneo de códigos de barra.
4. [Cart](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/wiki/cart.md)
   * Gestión del carrito de compras (Zustand) y desglose de montos.
5. [Loyalty](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/wiki/loyalty.md)
   * Validación y registro de tarjetas de fidelización según motores requeridos por el carrito.
6. [Payment](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/wiki/payment.md)
   * Selección de métodos de pago (Pago Móvil, VPOS, Gift Card, etc.), pagos parciales (splits), e integración con la máquina de estados `saleMachine`.
7. [Setup](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/wiki/setup.md)
   * Configuración de terminal, proxy de Odoo y pruebas de impresora.
8. [Advanced](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/wiki/advanced.md)
   * Menú administrativo protegido por PIN (devoluciones, reimpresiones, cierres de sesión X/Z).

---

## Flujo de Navegación del Kiosco

El flujo está centralizado mediante una máquina de estados finitos gestionada por **XState** (`saleMachine.ts`):

```
[ Welcome (Idle) ]
        │
        ▼
[ Customer (Cédula) ] ───(No Existe)───► [ Customer (Registro) ]
        │                                         │
        ├─────────────────────────────────────────┘
        ▼
[ Catalog & Cart ]
        │
        ▼
[ Loyalty Check (Si aplica) ]
        │
        ▼
[ Payment Select ] ───(Split / Pago)───► [ Payment Form ]
        │                                       │
        ├───────────────────────────────────────┘
        ▼
[ Processing (Odoo) ]
        │
        ▼
[ Printing Fiscal ]
        │
        ▼
[ Success Screen ] (Retorna a Idle en 10s)
```
