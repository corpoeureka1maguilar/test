import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '@/shared/stores/config'
import { useUIStore } from '@/shared/stores/ui'
import { FiscalPrinterAdapter } from '@/shared/lib/fiscalPrinter'
import styles from './Setup.module.css'

export function PrinterTest() {
  const navigate = useNavigate()
  const currentPrinterUrl = useConfigStore((s) => s.printerUrl)
  const { pushToast } = useUIStore()

  const [printerUrl, setPrinterUrl] = useState(
    currentPrinterUrl || 'http://127.0.0.1/ServWebImpresion/api/'
  )
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
    const printer = new FiscalPrinterAdapter(printerUrl)
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
    const printer = new FiscalPrinterAdapter(printerUrl)

    // Payload de factura de prueba minimalista (compatible con el formato de la impresora)
    const testPayload = {
      condicion: 'Pago inmediato',
      codigobarra: '',
      montoigtf: '0.00',
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
          cantidad: '1.000',
          precio: '0.10',
          descuentop: '0.00'
        }
      ],
      pago01: '0.10'
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
    <div className="kiosk-container" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 className={styles.title}>Prueba de Impresora Fiscal</h1>

      <div className={styles.form}>
        <label>
          URL del Servicio de Impresión
          <input
            type="text"
            value={printerUrl}
            onChange={(e) => setPrinterUrl(e.target.value)}
            placeholder="http://127.0.0.1/ServWebImpresion/api/"
            required
          />
        </label>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestConnection}
            disabled={testingConnection || printingTest}
            style={{ flex: 1 }}
          >
            {testingConnection ? 'Probando...' : 'Probar Conexión'}
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSendTestPrint}
            disabled={testingConnection || printingTest}
            style={{ flex: 1 }}
          >
            {printingTest ? 'Imprimiendo...' : 'Imprimir Ticket de Prueba'}
          </button>
        </div>

        {testResult && (
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              borderRadius: '8px',
              border: `1px solid ${testResult.success ? '#22c55e' : '#ef4444'}`,
              backgroundColor: testResult.success ? '#f0fdf4' : '#fef2f2',
              color: testResult.success ? '#166534' : '#991b1b'
            }}
          >
            <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>{testResult.message}</h4>
            {testResult.details && <p style={{ margin: 0, fontSize: '0.9rem', fontFamily: 'monospace' }}>{testResult.details}</p>}
          </div>
        )}

        <button
          type="button"
          className="btn"
          onClick={() => navigate('/setup')}
          style={{ marginTop: '2rem', width: '100%', border: '1px solid #ccc' }}
        >
          Volver a Configuración
        </button>
      </div>
    </div>
  )
}
