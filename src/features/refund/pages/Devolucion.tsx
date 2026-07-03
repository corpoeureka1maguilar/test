import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSearchOrders } from '@/features/refund/hooks/useSearchOrders'
import { useOrder } from '@/features/cart/hooks/useOrder'
import { AppOrderSummary } from '@/features/cart/components/AppOrderSummary'
import { returnOrder } from '@/shared/lib/odooRepository'
import { useUIStore } from '@/shared/stores/ui'
import { useConfigStore } from '@/shared/stores/config'
import { useSessionStore } from '@/shared/stores/session'
import { FiscalPrinterAdapter } from '@/shared/lib/fiscalPrinter'
import type { KioskOrder } from '@/shared/types/types'
import { formatBs, formatUSD } from '@/shared/lib/money'
import { useExchangeRateStore } from '@/shared/stores/exchangeRate'
import { getMetrics, resetMetrics, trackRefund } from '@/shared/lib/metrics'
import styles from './Devolucion.module.css'

export function Devolucion() {
  const navigate = useNavigate()
  const location = useLocation()
  const { pushToast, setLoading } = useUIStore()
  const config = useConfigStore()

  const defaultTab = (location.state as any)?.defaultTab || 'devoluciones'
  const [activeTab, setActiveTab] = useState<'devoluciones' | 'cierres' | 'terminal' | 'metrics'>(defaultTab)
  const [pattern, setPattern] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<KioskOrder | null>(null)
  const [reason, setReason] = useState('')
  const [done, setDone] = useState(false)
  const [metrics, setMetrics] = useState(() => getMetrics())
  const rate = useExchangeRateStore((s) => s.rate)

  const sessionState = useSessionStore((s) => s.sessionState)
  const sessionId = useSessionStore((s) => s.sessionId)
  const cashierName = useSessionStore((s) => s.cashierName)
  const openingDate = useSessionStore((s) => s.openingDate)
  const openSession = useSessionStore((s) => s.openSession)
  const closeSession = useSessionStore((s) => s.closeSession)

  const handleOpenSession = async () => {
    if (!config.stationId) {
      pushToast('error', 'La estación no está configurada. Configurala en la pestaña Terminal.')
      return
    }
    setLoading(true)
    try {
      await openSession(config.stationId)
      pushToast('success', 'Sesión de caja aperturada con éxito en Odoo')
    } catch (err) {
      pushToast('error', `Error al abrir sesión: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCloseSession = async () => {
    if (!window.confirm('¿Estás seguro de que querés cerrar la sesión de caja en Odoo? El kiosco no podrá procesar ventas hasta que se vuelva a abrir.')) {
      return
    }
    setLoading(true)
    try {
      await closeSession()
      pushToast('success', 'Sesión de caja cerrada con éxito en Odoo')
    } catch (err) {
      pushToast('error', `Error al cerrar sesión: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'metrics') {
      setMetrics(getMetrics())
    }
  }, [activeTab])

  const handleResetMetrics = () => {
    if (window.confirm('¿Estás seguro de que querés restablecer todas las métricas a cero?')) {
      resetMetrics()
      setMetrics(getMetrics())
      pushToast('success', 'Métricas restablecidas')
    }
  }

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
      await returnOrder(order, reason, sessionId)
      trackRefund()
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
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'metrics' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          Métricas
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
                    <span className={styles.amount}>{formatBs(o.amountTotal)}{rate > 0 && <span className={styles.amountUsd}>{formatUSD(o.amountTotal / rate)}</span>}</span>
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
        <div className={styles.cierresContainer}>
          <div className={styles.sessionCard}>
            <div className={styles.sessionHeader}>
              <h3>Estado de la Sesión</h3>
              <span className={`${styles.badge} ${sessionState === 'opened' ? styles.badgeOpen : styles.badgeClosed}`}>
                {sessionState === 'opened' ? '🟢 ACTIVA' : sessionState === 'checking' ? '🟡 VERIFICANDO...' : '🔴 CERRADA'}
              </span>
            </div>
            
            <div className={styles.sessionDetails}>
              <p><strong>Estación:</strong> {config.stationName || 'No configurada'}</p>
              {sessionState === 'opened' && (
                <>
                  <p><strong>Cajero Activo:</strong> {cashierName}</p>
                  <p><strong>Fecha de Apertura:</strong> {openingDate ? new Date(openingDate).toLocaleString() : 'N/A'}</p>
                  <p><strong>ID de Sesión:</strong> {sessionId}</p>
                </>
              )}
            </div>

            <div className={styles.sessionActions}>
              {sessionState === 'closed' && (
                <button type="button" className="btn btn-primary" onClick={handleOpenSession} style={{ width: '100%' }}>
                  Aperturar Caja
                </button>
              )}
              {sessionState === 'opened' && (
                <button type="button" className="btn btn-danger" onClick={handleCloseSession} style={{ width: '100%' }}>
                  Cerrar Caja
                </button>
              )}
            </div>
          </div>

          {sessionState === 'opened' && (
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

      {activeTab === 'metrics' && (
        <div className={styles.metricsContainer}>
          {/* KPI Dashboard Grid */}
          <div className={styles.metricsGrid}>
            <div className={`${styles.metricCard} ${styles.salesCard}`}>
              <span className={styles.metricLabel}>Ventas Totales</span>
              <span className={styles.metricValue}>{formatBs(metrics.sales.totalAmount)}</span>
              <span className={styles.metricSubvalue}>Volumen acumulado</span>
            </div>

            <div className={`${styles.metricCard} ${styles.ticketCard}`}>
              <span className={styles.metricLabel}>Ticket Promedio</span>
              <span className={styles.metricValue}>
                {formatBs(
                  metrics.sales.orderCount > 0
                    ? metrics.sales.totalAmount / metrics.sales.orderCount
                    : 0
                )}
              </span>
              <span className={styles.metricSubvalue}>Por transacción</span>
            </div>

            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Transacciones</span>
              <span className={styles.metricValue}>{metrics.sales.orderCount}</span>
              <span className={styles.metricSubvalue}>Ventas exitosas</span>
            </div>

            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Devoluciones</span>
              <span className={styles.metricValue}>{metrics.sales.refundCount}</span>
              <span className={styles.metricSubvalue}>Órdenes devueltas</span>
            </div>

            <div className={styles.metricCard} style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(255, 255, 255, 0.8) 100%)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
              <span className={styles.metricLabel}>Tiempo Muerto</span>
              <span className={styles.metricValue}>
                {(() => {
                  const sec = metrics.viewsDuration['/'] || 0
                  if (!sec) return '0s'
                  if (sec < 60) return `${sec}s`
                  const m = Math.floor(sec / 60)
                  const s = sec % 60
                  return s > 0 ? `${m}m ${s}s` : `${m}m`
                })()}
              </span>
              <span className={styles.metricSubvalue}>Standby en Inicio</span>
            </div>
          </div>

          {/* Dos columnas de detalles */}
          <div className={styles.dashboardSection}>
            {/* Uso de vistas */}
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Uso por Vista</h3>
              <div className={styles.listContainer}>
                {Object.keys(metrics.views).length === 0 ? (
                  <p className={styles.emptyState}>No hay registros de navegación aún</p>
                ) : (
                  Object.entries(metrics.views)
                    .sort((a, b) => b[1] - a[1])
                    .map(([viewPath, count]) => {
                      const maxCount = Math.max(...Object.values(metrics.views), 1)
                      const percent = (count / maxCount) * 100
                      const duration = metrics.viewsDuration?.[viewPath] || 0
                      const formatDuration = (sec: number) => {
                        if (!sec) return '0s'
                        if (sec < 60) return `${sec}s`
                        const m = Math.floor(sec / 60)
                        const s = sec % 60
                        return s > 0 ? `${m}m ${s}s` : `${m}m`
                      }

                      const isWelcome = viewPath === '/'
                      const displayName = isWelcome ? 'Inicio (Tiempo Muerto / Standby)' : viewPath

                      return (
                        <div key={viewPath} className={styles.viewItem}>
                          <div className={styles.viewMeta}>
                            <span 
                              className={styles.itemName}
                              style={isWelcome ? { color: 'var(--color-text-muted)', fontStyle: 'italic' } : undefined}
                            >
                              {displayName}
                            </span>
                            <span className={styles.itemCount}>
                              {count} v. • {formatDuration(duration)}
                            </span>
                          </div>
                          <div className={styles.progressBarContainer}>
                            <div
                              className={styles.progressBar}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </div>

            {/* Métodos de Pago */}
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>Métodos de Pago</h3>
              <div className={styles.listContainer}>
                {Object.keys(metrics.sales.paymentMethods).length === 0 ? (
                  <p className={styles.emptyState}>Sin ventas registradas</p>
                ) : (
                  Object.entries(metrics.sales.paymentMethods)
                    .sort((a, b) => b[1].amount - a[1].amount)
                    .map(([methodName, data]) => (
                      <div key={methodName} className={styles.listItem}>
                        <span className={styles.itemName}>
                          {methodName} ({data.count} u.)
                        </span>
                        <span className={styles.itemAmount}>{formatBs(data.amount)}</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          <div className={styles.dashboardSection}>
            {/* Top Productos */}
            <div className={`${styles.sectionCard}`} style={{ gridColumn: 'span 2' }}>
              <h3 className={styles.sectionTitle}>Productos Más Vendidos</h3>
              <div className={styles.listContainer}>
                {Object.keys(metrics.sales.topProducts).length === 0 ? (
                  <p className={styles.emptyState}>Sin ventas registradas</p>
                ) : (
                  Object.values(metrics.sales.topProducts)
                    .sort((a, b) => b.qty - a.qty)
                    .slice(0, 10)
                    .map((prod, index) => (
                      <div key={index} className={styles.listItem}>
                        <span className={styles.itemName}>
                          #{index + 1} {prod.name}
                        </span>
                        <span className={styles.itemCount}>{prod.qty} unidades</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className={styles.dangerZone}>
            <button type="button" className={styles.resetBtn} onClick={handleResetMetrics}>
              Restablecer Métricas
            </button>
          </div>
        </div>
      )}

      <button type="button" className="btn" style={{ marginTop: 'auto' }} onClick={() => navigate('/')}>
        Volver al inicio
      </button>
    </div>
  )
}
