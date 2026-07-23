import { KIOSK_OPERATIONS } from '@/shared/lib/odooRepository'
import { useUIStore } from '@/shared/stores/ui'
import { useConfigStore } from '@/shared/stores/config'
import { FiscalPrinterAdapter } from '@/shared/lib/fiscalPrinter'
import type { PendingAdminAction } from './useAdminPinAction'

export function useFiscalReports(requestAdminAction: (action: PendingAdminAction) => void) {
  const { pushToast, setLoading } = useUIStore()
  const config = useConfigStore()

  const requestPrintReport = (tipo: 'X' | 'Z', reportName: string) => {
    requestAdminAction({
      title: `Confirma para imprimir: ${reportName}`,
      operationRef: tipo === 'Z' ? KIOSK_OPERATIONS.sessionClose : KIOSK_OPERATIONS.shiftClose,
      auditMessage: `Impresión de reporte ${tipo}: ${reportName}`,
      run: () => {
        void handlePrintReport(tipo, reportName)
      }
    })
  }

  const handlePrintReport = async (tipo: 'X' | 'Z', reportName: string) => {
    const printerUrl = config.printerUrl
    if (!printerUrl) {
      pushToast('error', 'La URL de la impresora fiscal no está configurada')
      return
    }

    setLoading(true)
    try {
      const printer = new FiscalPrinterAdapter(printerUrl, config.printerModel)
      await printer.checkConnection()
      const response = await printer.sendRequest('PrintReporte', { tipo })
      pushToast('success', `${reportName} impreso con éxito. Nro Reporte: ${response.numReporte || 'N/A'}`)
    } catch (err) {
      pushToast('error', `Error al imprimir: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return { requestPrintReport }
}
