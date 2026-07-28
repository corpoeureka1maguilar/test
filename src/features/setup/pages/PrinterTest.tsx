import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '@/shared/stores/config'
import { useUIStore } from '@/shared/stores/ui'
import { FiscalPrinterAdapter } from '@/shared/lib/fiscalPrinter'

export function PrinterTest() {
  const navigate = useNavigate()
  const currentPrinterUrl = useConfigStore((s) => s.printerUrl)
  const currentPrinterModel = useConfigStore((s) => s.printerModel)
  const { pushToast } = useUIStore()

  const [printerUrl, setPrinterUrl] = useState(
    currentPrinterUrl || 'http://127.0.0.1/ServWebImpresion/api/'
  )
  const [printerModel, setPrinterModel] = useState(currentPrinterModel || '')
  const [testingConnection, setTestingConnection] = useState(false)
  const [printingTest, setPrintingTest] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    details?: string
  } | null>(null)

  const handleTestConnection = async () => {
    setTestingConnection(true)
    setTestResult(null)
    const printer = new FiscalPrinterAdapter(printerUrl, printerModel)
    try {
      await printer.checkConnection()
      setTestResult({
        success: true,
        message: '¡Conexión exitosa con el servicio de la impresora!'
      })
      pushToast('success', 'Conexión exitosa')
    } catch (err) {
      const errMsg = (err as Error).message || 'Error desconocido'
      setTestResult({
        success: false,
        message: 'Error de conexión',
        details: errMsg
      })
      pushToast('error', `Error de conexión: ${errMsg}`)
    } finally {
      setTestingConnection(false)
    }
  }

  const handleSendTestPrint = async () => {
    setPrintingTest(true)
    setTestResult(null)
    const printer = new FiscalPrinterAdapter(printerUrl, printerModel)

    // Payload de factura de prueba minimalista (compatible con el formato de la impresora)
    const testPayload = {
      condicion: 'Pago inmediato',
      codigobarra: '',
      montoigtf: '0',
      direccion: 'CONSUMIDOR FINAL',
      documento: 'V999999999',
      nombre: 'CONSUMIDOR FINAL',
      referencia: 'TEST-CONNECTION',
      rif: 'V999999999',
      caja: 'Autopago Test',
      Items: [
        {
          codigo: 'TEST',
          descripcion: 'PRUEBA DE CONEXION',
          impuesto: '1',
          tasa: '1',
          cantidad: '1000',
          precio: '10',
          descuentop: '0'
        }
      ],
      pago01: '10'
    }

    try {
      const response = await printer.printFactura(testPayload)
      setTestResult({
        success: true,
        message: '¡Orden de impresión enviada y procesada con éxito!',
        details: `Factura N°: ${response.numfactura || 'N/A'} | Serial: ${response.serial || 'N/A'} | Fecha: ${response.fecha || 'N/A'} ${response.hora || 'N/A'}`
      })
      pushToast('success', 'Impresión de prueba exitosa')
    } catch (err) {
      const errMsg = (err as Error).message || 'Error al imprimir'
      setTestResult({
        success: false,
        message: 'Error al enviar orden de impresión',
        details: errMsg
      })
      pushToast('error', `Error de impresión: ${errMsg}`)
    } finally {
      setPrintingTest(false)
    }
  }

  return (
    <div className="kiosk-container p-8 max-w-[600px] mx-auto">
      <h1 className="text-[2rem] font-bold mb-8">Prueba de Impresora Fiscal</h1>

      <div className="flex flex-col gap-5 max-w-[600px]">
        <label className="flex flex-col gap-[0.4rem] text-base font-semibold">
          URL del Servicio de Impresión
          <input
            type="text"
            value={printerUrl}
            onChange={(e) => setPrinterUrl(e.target.value)}
            placeholder="http://127.0.0.1/ServWebImpresion/api/"
            required
          />
        </label>

        <label className="flex flex-col gap-[0.4rem] text-base font-semibold">
          Modelo de la Impresora
          <input
            type="text"
            value={printerModel}
            onChange={(e) => setPrinterModel(e.target.value)}
            placeholder="Ej. HKA, Bixolon, Bematech..."
          />
        </label>

        <div className="flex gap-4 mt-4">
          <button
            type="button"
            className="btn btn-secondary flex-1"
            onClick={() => {
              void handleTestConnection()
            }}
            disabled={testingConnection || printingTest}
          >
            {testingConnection ? 'Probando...' : 'Probar Conexión'}
          </button>

          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={() => {
              void handleSendTestPrint()
            }}
            disabled={testingConnection || printingTest}
          >
            {printingTest ? 'Imprimiendo...' : 'Imprimir Ticket de Prueba'}
          </button>
        </div>

        {testResult && (
          <div
            className={`mt-6 p-4 rounded-lg ${
              testResult.success
                ? 'border border-[#22c55e] bg-[#f0fdf4] text-[#166534]'
                : 'border border-danger bg-[#fef2f2] text-[#991b1b]'
            }`}
          >
            <h4 className="mt-0 mb-2 font-bold">{testResult.message}</h4>
            {testResult.details && <p className="m-0 text-[0.9rem] font-mono">{testResult.details}</p>}
          </div>
        )}

        <button
          type="button"
          className="btn mt-8 w-full border border-[#ccc]"
          onClick={() => navigate('/setup')}
        >
          Volver a Configuración
        </button>
      </div>
    </div>
  )
}
