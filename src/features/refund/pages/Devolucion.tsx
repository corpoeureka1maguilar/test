import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSearchOrders } from '@/features/refund/hooks/useSearchOrders'
import { useOrder } from '@/features/cart/hooks/useOrder'
import { AppOrderSummary } from '@/features/cart/components/AppOrderSummary'
import { returnOrder } from '@/shared/lib/odooRepository'
import { useUIStore } from '@/shared/stores/ui'
import { useConfigStore } from '@/shared/stores/config'
import { FiscalPrinterAdapter } from '@/shared/lib/fiscalPrinter'
import type { KioskOrder } from '@/shared/types/types'
import { formatBs } from '@/shared/lib/money'
import styles from './Devolucion.module.css'

export function Devolucion() {
  const navigate = useNavigate()
  const { pushToast, setLoading } = useUIStore()
  const config = useConfigStore()

  const [activeTab, setActiveTab] = useState<'devoluciones' | 'cierres' | 'terminal'>('devoluciones')
  const [pattern, setPattern] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<KioskOrder | null>(null)
  const [reason, setReason] = useState('')
  const [done, setDone] = useState(false)

  // Formulario para la parametrización de la terminal
  const [form, setForm] = useState({
    odooUrl: config.odooUrl,
    odooDb: config.odooDb,
    serviceUser: config.serviceUser,
    servicePassword: config.servicePassword,
    printerUrl: config.printerUrl,
    printerModel: config.printerModel,
    adminPin: ''
  })

  const { data: results = [], isFetching } = useSearchOrders(pattern)
  const { data: orderDetail } = useOrder(selectedOrder?.id ?? null)

  const order = orderDetail ?? selectedOrder

  const handleReturn = async () => {
    if (!order || !reason.trim()) {
      pushToast('error', 'Indicá el motivo de la devolución')
      return
    }

    setLoading(true)
    try {
      await returnOrder(order.id, reason)
      setDone(true)
      pushToast('success', 'Devolución procesada correctamente')
    } catch (err) {
      pushToast('error', `Error: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
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

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.adminPin.length < 4) {
      pushToast('error', 'El PIN de administrador debe tener al menos 4 dígitos')
      return
    }

    setLoading(true)
    try {
      await config.saveConfig(form)
      pushToast('success', 'Configuración de la terminal guardada y sincronizada')
      setForm(f => ({ ...f, adminPin: '' })) // Limpiar el pin por seguridad
    } catch (err) {
      pushToast('error', `Error al guardar configuración: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const setFormField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  if (done) {
    return (
      <div className={`kiosk-container ${styles.center}`}>
        <div className={styles.iconSuccess}>✓</div>
        <h2>Devolución procesada</h2>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </div>
    )
  }

  return (
    <div className="kiosk-container">
      <h2 className={styles.title}>Menú Avanzado</h2>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'devoluciones' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('devoluciones')}
        >
          Devoluciones
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'cierres' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('cierres')}
        >
          Cierres de Caja
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'terminal' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('terminal')}
        >
          Terminal
        </button>
      </div>

      {activeTab === 'devoluciones' && (
        <>
          {!selectedOrder ? (
            <>
              <input
                type="text"
                className={styles.search}
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="Buscá la orden a devolver"
                autoFocus
              />
              {isFetching && <p className={styles.info}>Buscando...</p>}
              <div className={styles.results}>
                {results.map((o) => (
                  <button key={o.id} type="button" className={styles.resultCard} onClick={() => setSelectedOrder(o)}>
                    <span className={styles.orderName}>{o.name}</span>
                    <span>{o.partnerId[1]}</span>
                    <span className={styles.amount}>{formatBs(o.amountTotal)}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {order && (
                <div className="card">
                  <AppOrderSummary order={order} />
                </div>
              )}
              <label className={styles.reasonLabel}>Motivo de devolución
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="">Seleccione un motivo</option>
                  <option value="averia">Por avería</option>
                  <option value="producto">Por producto</option>
                </select>
              </label>
              <div className={styles.actions}>
                <button type="button" className="btn btn-danger" onClick={handleReturn}>
                  Confirmar devolución
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>
                  Buscar otra orden
                </button>
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'cierres' && (
        <div className={styles.cierresGrid}>
          <button
            type="button"
            className={`${styles.cierreCard} ${styles.cierreTurno}`}
            onClick={() => handlePrintReport('X', 'Cierre de Turno')}
          >
            <div className={styles.cierreIcon}>⏱</div>
            <div className={styles.cierreTitle}>Cierre de Turno</div>
            <div className={styles.cierreDesc}>Imprime Reporte X sin cerrar memoria fiscal del día</div>
          </button>

          <button
            type="button"
            className={`${styles.cierreCard} ${styles.cierreCaja}`}
            onClick={() => handlePrintReport('X', 'Cierre de Caja')}
          >
            <div className={styles.cierreIcon}>💵</div>
            <div className={styles.cierreTitle}>Cierre de Caja</div>
            <div className={styles.cierreDesc}>Lectura de acumulados de caja - Reporte X</div>
          </button>

          <button
            type="button"
            className={`${styles.cierreCard} ${styles.cierreZ}`}
            onClick={() => handlePrintReport('Z', 'Cierre de Reporte Z')}
          >
            <div className={styles.cierreIcon}>📊</div>
            <div className={styles.cierreTitle}>Cierre de Reporte Z</div>
            <div className={styles.cierreDesc}>Cierre fiscal obligatorio del día - Reporte Z</div>
          </button>
        </div>
      )}

      {activeTab === 'terminal' && (
        <form className={styles.configForm} onSubmit={handleSaveConfig}>
          <div className={styles.formGrid}>
            <label className={styles.fieldLabel}>URL de Odoo
              <input type="text" value={form.odooUrl} onChange={setFormField('odooUrl')} placeholder="https://mi-empresa.odoo.com" required />
            </label>
            <label className={styles.fieldLabel}>Base de datos
              <input type="text" value={form.odooDb} onChange={setFormField('odooDb')} placeholder="mi_base" required />
            </label>
            <label className={styles.fieldLabel}>Usuario de servicio
              <input type="text" value={form.serviceUser} onChange={setFormField('serviceUser')} placeholder="kiosco@empresa.com" required />
            </label>
            <label className={styles.fieldLabel}>Contraseña de Odoo
              <input type="password" value={form.servicePassword} onChange={setFormField('servicePassword')} required />
            </label>
            <label className={styles.fieldLabel}>URL Impresora Fiscal
              <input type="text" value={form.printerUrl} onChange={setFormField('printerUrl')} required />
            </label>
            <label className={styles.fieldLabel}>Modelo Impresora Fiscal
              <input type="text" value={form.printerModel} onChange={setFormField('printerModel')} placeholder="Ej. HKA, Bixolon, Bematech..." />
            </label>
            <label className={styles.fieldLabel}>PIN de Administrador (para confirmar)
              <input type="password" value={form.adminPin} onChange={setFormField('adminPin')} maxLength={6} required placeholder="PIN de 4 a 6 dígitos" />
            </label>
          </div>
          <button type="submit" className="btn btn-accent" style={{ marginTop: '1.5rem', width: '100%', maxWidth: '380px' }}>
            Guardar Configuración
          </button>
        </form>
      )}

      <button type="button" className="btn" style={{ marginTop: 'auto' }} onClick={() => navigate('/')}>
        Volver al inicio
      </button>
    </div>
  )
}
