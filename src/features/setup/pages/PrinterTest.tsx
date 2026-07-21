import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '@/shared/stores/config'
import { useUIStore } from '@/shared/stores/ui'
import { FiscalPrinterAdapter } from '@/shared/lib/fiscalPrinter'
import styles from './Setup.module.css'

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
    <div className={`kiosk-container ${styles.container}`}>
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

        <label>
          Modelo de la Impresora
          <input
            type="text"
            value={printerModel}
            onChange={(e) => setPrinterModel(e.target.value)}
            placeholder="Ej. HKA, Bixolon, Bematech..."
          />
        </label>

        <div className={styles.actionsRow}>
          <button
            type="button"
            className={`btn btn-secondary ${styles.actionBtn}`}
            onClick={handleTestConnection}
            disabled={testingConnection || printingTest}
          >
            {testingConnection ? 'Probando...' : 'Probar Conexión'}
          </button>

          <button
            type="button"
            className={`btn btn-primary ${styles.actionBtn}`}
            onClick={handleSendTestPrint}
            disabled={testingConnection || printingTest}
          >
            {printingTest ? 'Imprimiendo...' : 'Imprimir Ticket de Prueba'}
          </button>
        </div>

        {testResult && (
          <div
            className={`${styles.resultBox} ${testResult.success ? styles.resultBoxSuccess : styles.resultBoxError}`}
          >
            <h4 className={styles.resultTitle}>{testResult.message}</h4>
            {testResult.details && <p className={styles.resultDetails}>{testResult.details}</p>}
          </div>
        )}

        <button
          type="button"
          className={`btn ${styles.backBtn}`}
          onClick={() => navigate('/setup')}
        >
          Volver a Configuración
        </button>
      </div>
    </div>
  )
}
