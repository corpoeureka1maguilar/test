import { KIOSK_OPERATIONS } from '@/shared/lib/odooRepository'
import { useUIStore } from '@/shared/stores/ui'
import { useConfigStore } from '@/shared/stores/config'
import { useSessionStore } from '@/shared/stores/session'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { FiscalPrinterAdapter, noFiscalItem, type NoFiscalItem } from '@/shared/lib/fiscalPrinter'
import { formatUSD, formatBs } from '@/shared/lib/money'
import {
  fetchSessionCashTotals,
  recomputeSessionAmounts,
  fetchSessionPaymentTotals,
  fetchSessionAmountTotals
} from '@/shared/lib/odooRepository'
import type { PendingAdminAction } from './useAdminPinAction'

// Mismo layout que getCustomXReportData en eu_fex_ppal/src/renderer/src/pages/Cierre.vue:
// separador de 75 columnas (límite real de noFiscalItem), etiqueta de 15
// columnas y monto alineado a la derecha en 35.
const SEPARATOR = noFiscalItem('-'.repeat(75))
const label = (text: string) => (text + ':').padEnd(15, ' ')
const padAmount = (text: string) => text.padStart(35, ' ')

const ticketTitle = (title: string): NoFiscalItem[] => [SEPARATOR, noFiscalItem(title, 'NC'), SEPARATOR]

const amountsLine = (baseText: string, refText: string): NoFiscalItem[] => [
  noFiscalItem(label('Dólares') + padAmount(baseText)),
  noFiscalItem(label('Bolívares') + padAmount(refText))
]

const paymentMethodLine = (name: string, base: number, ref: number): NoFiscalItem =>
  noFiscalItem(label(name) + padAmount(formatUSD(base) + formatBs(ref).padStart(20, ' ')))

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

  // "Cierre de Turno": a diferencia de "Cierre de Caja" (Reporte X puro), acá
  // se imprime un ticket no fiscal a medida con los totales de la sesión y,
  // si la impresión fue exitosa, se cierra la sesión de caja automáticamente
  // (espeja closeCallback + printCierreTurno de eu_fex_ppal/pages/Cierre.vue).
  const requestCierreTurno = () => {
    requestAdminAction({
      title: 'Confirma para cerrar turno',
      operationRef: KIOSK_OPERATIONS.shiftClose,
      auditMessage: 'Cierre de turno: ticket no fiscal de totales + cierre de sesión',
      run: () => {
        void handleCierreTurno()
      }
    })
  }

  const buildCierreTurnoTicket = async (): Promise<NoFiscalItem[]> => {
    const { sessionId, cashierName } = useSessionStore.getState()
    if (!sessionId) throw new Error('No hay una sesión de caja activa')

    const stationName = config.stationName
    // Última tasa buena conocida (sincronizada por useExchangeRateSync); igual
    // que $cash.rate en ppal, que tampoco se refetchea acá.
    const rate = useExchangeRateStore.getState().rate || 1

    await recomputeSessionAmounts(sessionId)

    const [cashTotals, amountTotals, paymentTotals] = await Promise.all([
      fetchSessionCashTotals(sessionId),
      fetchSessionAmountTotals(sessionId),
      fetchSessionPaymentTotals(sessionId)
    ])

    const totalSales = amountTotals['total'] ?? 0
    const totalCredit = amountTotals['totalCredit'] ?? 0
    const totalRefund = amountTotals['totalRefund'] ?? 0
    const totalRetenido = amountTotals['totalRetenido'] ?? 0

    return [
      ...ticketTitle('Reporte de cierre de turno'),
      noFiscalItem(label('Caja') + stationName, 'N'),
      noFiscalItem(label('Cajero') + cashierName, 'N'),
      noFiscalItem(label('Tasa') + rate.toString(), 'N'),
      ...ticketTitle('Total en caja'),
      ...amountsLine(formatUSD(cashTotals.totalCashBalance), formatBs(cashTotals.totalCashBalanceRef)),
      ...ticketTitle('Total en ventas'),
      ...amountsLine(formatUSD(totalSales), formatBs(totalSales * rate)),
      SEPARATOR,
      ...paymentTotals.map((total) => paymentMethodLine(total.method, total.total, total.total_ref)),
      paymentMethodLine('Crédito', totalCredit, totalCredit * rate),
      paymentMethodLine('Devolución', totalRefund, totalRefund * rate),
      paymentMethodLine('Retenido', totalRetenido, totalRetenido * rate),
      SEPARATOR
    ]
  }

  const handleCierreTurno = async () => {
    const printerUrl = config.printerUrl
    if (!printerUrl) {
      pushToast('error', 'La URL de la impresora fiscal no está configurada')
      return
    }

    setLoading(true)
    try {
      const items = await buildCierreTurnoTicket()

      const printer = new FiscalPrinterAdapter(printerUrl, config.printerModel)
      await printer.checkConnection()
      await printer.printNoFiscal(items)

      // Si la impresión falla, el catch de abajo corta acá y NO cierra la
      // sesión. Reutilizamos closeSession del store (misma acción que usa
      // useSessionControls) en vez de reimplementar el cierre en Odoo.
      try {
        await useSessionStore.getState().closeSession()
        pushToast('success', 'Cierre de turno impreso y sesión cerrada con éxito')
      } catch (closeErr) {
        pushToast('error', `El ticket se imprimió, pero no se pudo cerrar la sesión: ${(closeErr as Error).message}`)
      }
    } catch (err) {
      pushToast('error', `Error al imprimir cierre de turno: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return { requestPrintReport, requestCierreTurno }
}
