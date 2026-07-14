import type { AutopayMetrics } from '@/shared/lib/metrics'
import { formatBs, formatUSD } from '@/shared/lib/money'
import styles from '../pages/AdvancedMenu.module.css'

interface Props {
  metrics: AutopayMetrics
  rate: number
  onResetMetrics: () => void
}

export function MetricsTab({ metrics, rate, onResetMetrics }: Props) {
  return (
    <div className={styles.metricsContainer}>
      {/* KPI Dashboard Grid */}
      <div className={styles.metricsGrid}>
        <div className={`${styles.metricCard} ${styles.salesCard}`}>
          <span className={styles.metricLabel}>Ventas Totales</span>
          <span className={styles.metricValue}>
            {rate > 0 ? formatUSD(metrics.sales.totalAmount / rate) : formatBs(metrics.sales.totalAmount)}
          </span>
          <span className={styles.metricSubvalue}>
            {rate > 0 ? formatBs(metrics.sales.totalAmount) : 'Volumen acumulado'}
          </span>
        </div>

        <div className={`${styles.metricCard} ${styles.ticketCard}`}>
          <span className={styles.metricLabel}>Ticket Promedio</span>
          <span className={styles.metricValue}>
            {(() => {
              const avg = metrics.sales.orderCount > 0
                ? metrics.sales.totalAmount / metrics.sales.orderCount
                : 0
              return rate > 0 ? formatUSD(avg / rate) : formatBs(avg)
            })()}
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
        <button type="button" className={styles.resetBtn} onClick={onResetMetrics}>
          Restablecer Métricas
        </button>
      </div>
    </div>
  )
}
