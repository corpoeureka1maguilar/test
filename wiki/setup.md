# Feature: Setup (Configuración del Dispositivo)

La feature `setup` se encarga de la parametrización inicial del Kiosco de Autopago. Al iniciar la aplicación por primera vez, o si no se detecta una configuración válida, se redirige automáticamente al flujo de configuración para garantizar la conectividad con las dependencias externas (Odoo e Impresora Fiscal).

## Páginas y Utilidades

* **[Setup.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/setup/pages/Setup.tsx)**:
  Formulario de configuración del dispositivo que persiste las variables en el almacenamiento local persistido (Zustand config store). Campos configurables:
  * **Odoo Connection**: URL del backend Odoo, base de datos, usuario y contraseña/token para JSON-RPC.
  * **Terminal/Caja**: Identificación de la caja (Terminal ID), almacén (Warehouse) y diario de ventas por defecto.
  * **Configuración de Impresora Fiscal**: URL local del servicio de impresión fiscal (ej. `http://localhost:8080` que expone la API de ServWebImpresion).
* **[PrinterTest.tsx](file:///C:/Users/maguilar/Desktop/maikol/fex/eu_fex_autopay/src/features/setup/pages/PrinterTest.tsx)**:
  Pantalla de prueba para validar que la conexión y comunicación con la impresora fiscal sea correcta. Permite enviar comandos de prueba (como reporte de estado, reporte X sin valor fiscal, o impresión de prueba).

## Funcionamiento Técnico

1. **Persistencia**: La configuración cargada a través del formulario se guarda en un store de Zustand (`useConfigStore`) que está configurado con persistencia automática en `localStorage`.
2. **Redirección de Arranque**: En el router de la aplicación, un componente guardián (`ConfigGuard`) verifica si existen las credenciales y URLs obligatorias en el store. En caso negativo, redirige de forma inmediata a `/setup`.
3. **Establecimiento de Proxy**: Una vez guardada la configuración de Odoo, se registra contra el proxy dinámico local (`POST /__odoo-proxy-target`) para sortear problemas de CORS en el navegador.
