import type { AutopayMetrics } from '@/shared/lib/metrics'
import { formatBs, formatUSD } from '@/shared/lib/money'

interface Props {
  metrics: AutopayMetrics
  rate: number
  onResetMetrics: () => void
}

export function MetricsTab({ metrics, rate, onResetMetrics }: Props) {
  return (
    <div className="flex flex-col gap-10 w-full max-w-[1100px] animate-scaleIn">
      {/* KPI Dashboard Grid */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] max-[900px]:grid-cols-[repeat(auto-fit,minmax(160px,1fr))] max-[550px]:grid-cols-1 gap-6 w-full">
        <div className="bg-panel border border-surface-border rounded-[20px] p-6 flex flex-col gap-2 text-left relative overflow-hidden shadow-app transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(0,0,0,0.08)] bg-[linear-gradient(135deg,rgba(16,185,129,0.08)_0%,rgba(255,255,255,0.8)_100%)] border-[rgba(16,185,129,0.3)]">
          <span className="text-[0.85rem] font-bold uppercase tracking-[0.06em] text-text-muted">Ventas Totales</span>
          <span className="text-[2rem] font-black text-text leading-[1.1] tabular-nums">
            {rate > 0 ? formatUSD(metrics.sales.totalAmount / rate) : formatBs(metrics.sales.totalAmount)}
          </span>
          <span className="text-[0.85rem] text-text-muted">
            {rate > 0 ? formatBs(metrics.sales.totalAmount) : 'Volumen acumulado'}
          </span>
        </div>

        <div className="bg-panel border border-surface-border rounded-[20px] p-6 flex flex-col gap-2 text-left relative overflow-hidden shadow-app transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(0,0,0,0.08)] bg-[linear-gradient(135deg,rgba(59,130,246,0.08)_0%,rgba(255,255,255,0.8)_100%)] border-[rgba(59,130,246,0.3)]">
          <span className="text-[0.85rem] font-bold uppercase tracking-[0.06em] text-text-muted">Ticket Promedio</span>
          <span className="text-[2rem] font-black text-text leading-[1.1] tabular-nums">
            {(() => {
              const avg = metrics.sales.orderCount > 0
                ? metrics.sales.totalAmount / metrics.sales.orderCount
                : 0
              return rate > 0 ? formatUSD(avg / rate) : formatBs(avg)
            })()}
          </span>
          <span className="text-[0.85rem] text-text-muted">Por transacción</span>
        </div>

        <div className="bg-panel border border-surface-border rounded-[20px] p-6 flex flex-col gap-2 text-left relative overflow-hidden shadow-app transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(0,0,0,0.08)]">
          <span className="text-[0.85rem] font-bold uppercase tracking-[0.06em] text-text-muted">Transacciones</span>
          <span className="text-[2rem] font-black text-text leading-[1.1] tabular-nums">{metrics.sales.orderCount}</span>
          <span className="text-[0.85rem] text-text-muted">Ventas exitosas</span>
        </div>

        <div className="bg-panel border border-surface-border rounded-[20px] p-6 flex flex-col gap-2 text-left relative overflow-hidden shadow-app transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(0,0,0,0.08)]">
          <span className="text-[0.85rem] font-bold uppercase tracking-[0.06em] text-text-muted">Devoluciones</span>
          <span className="text-[2rem] font-black text-text leading-[1.1] tabular-nums">{metrics.sales.refundCount}</span>
          <span className="text-[0.85rem] text-text-muted">Órdenes devueltas</span>
        </div>

        <div className="bg-panel border border-surface-border rounded-[20px] p-6 flex flex-col gap-2 text-left relative overflow-hidden shadow-app transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(0,0,0,0.08)] bg-[linear-gradient(135deg,rgba(239,68,68,0.05)_0%,rgba(255,255,255,0.8)_100%)] border-[rgba(239,68,68,0.2)]">
          <span className="text-[0.85rem] font-bold uppercase tracking-[0.06em] text-text-muted">Tiempo Muerto</span>
          <span className="text-[2rem] font-black text-text leading-[1.1] tabular-nums">
            {(() => {
              const sec = metrics.viewsDuration['/'] || 0
              if (!sec) return '0s'
              if (sec < 60) return `${sec}s`
              const m = Math.floor(sec / 60)
              const s = sec % 60
              return s > 0 ? `${m}m ${s}s` : `${m}m`
            })()}
          </span>
          <span className="text-[0.85rem] text-text-muted">Standby en Inicio</span>
        </div>
      </div>

      {/* Dos columnas de detalles */}
      <div className="grid grid-cols-2 gap-8 max-[850px]:grid-cols-1 max-[850px]:gap-6">
        {/* Uso de vistas */}
        <div className="bg-panel border border-surface-border rounded-[24px] p-8 text-left shadow-app flex flex-col gap-6">
          <h3 className="text-[1.25rem] font-extrabold text-text mb-2 border-b-2 border-surface pb-3">Uso por Vista</h3>
          <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto">
            {Object.keys(metrics.views).length === 0 ? (
              <p className="text-text-muted text-center py-12 px-4 text-[1.05rem]">No hay registros de navegación aún</p>
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
                    <div key={viewPath} className="flex flex-col gap-1 px-4 py-3 bg-surface rounded-[14px]">
                      <div className="flex justify-between items-center text-[0.95rem]">
                        <span
                          className={`font-bold text-text overflow-hidden text-ellipsis whitespace-nowrap max-w-[70%] ${isWelcome ? 'text-text-muted italic' : ''}`}
                        >
                          {displayName}
                        </span>
                        <span className="font-extrabold tabular-nums text-accent bg-accent-subtle px-3 py-1 rounded-full text-[0.9rem]">
                          {count} v. • {formatDuration(duration)}
                        </span>
                      </div>
                      <div className="w-full bg-surface-hover h-[6px] rounded-[3px] overflow-hidden mt-2">
                        <div
                          className="h-full bg-accent rounded-[3px]"
                          // eslint-disable-next-line react/forbid-dom-props -- ancho calculado en runtime a partir del % de uso, no se puede expresar en una clase estática
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
        <div className="bg-panel border border-surface-border rounded-[24px] p-8 text-left shadow-app flex flex-col gap-6">
          <h3 className="text-[1.25rem] font-extrabold text-text mb-2 border-b-2 border-surface pb-3">Métodos de Pago</h3>
          <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto">
            {Object.keys(metrics.sales.paymentMethods).length === 0 ? (
              <p className="text-text-muted text-center py-12 px-4 text-[1.05rem]">Sin ventas registradas</p>
            ) : (
              Object.entries(metrics.sales.paymentMethods)
                .sort((a, b) => b[1].amount - a[1].amount)
                .map(([methodName, data]) => (
                  <div key={methodName} className="flex items-center justify-between px-5 py-[0.85rem] bg-surface rounded-[14px] text-base transition-colors duration-200 hover:bg-surface-hover">
                    <span className="font-bold text-text overflow-hidden text-ellipsis whitespace-nowrap max-w-[70%]">
                      {methodName} ({data.count} u.)
                    </span>
                    <span className="font-[850] tabular-nums text-text">{formatBs(data.amount)}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 max-[850px]:grid-cols-1 max-[850px]:gap-6">
        {/* Top Productos */}
        <div className="bg-panel border border-surface-border rounded-[24px] p-8 text-left shadow-app flex flex-col gap-6 col-span-2">
          <h3 className="text-[1.25rem] font-extrabold text-text mb-2 border-b-2 border-surface pb-3">Productos Más Vendidos</h3>
          <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto">
            {Object.keys(metrics.sales.topProducts).length === 0 ? (
              <p className="text-text-muted text-center py-12 px-4 text-[1.05rem]">Sin ventas registradas</p>
            ) : (
              Object.values(metrics.sales.topProducts)
                .sort((a, b) => b.qty - a.qty)
                .slice(0, 10)
                .map((prod, index) => (
                  <div key={index} className="flex items-center justify-between px-5 py-[0.85rem] bg-surface rounded-[14px] text-base transition-colors duration-200 hover:bg-surface-hover">
                    <span className="font-bold text-text overflow-hidden text-ellipsis whitespace-nowrap max-w-[70%]">
                      #{index + 1} {prod.name}
                    </span>
                    <span className="font-extrabold tabular-nums text-accent bg-accent-subtle px-3 py-1 rounded-full text-[0.9rem]">{prod.qty} unidades</span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-6 border-t border-dashed border-surface-border pt-6 flex justify-end">
        <button
          type="button"
          className="bg-[rgba(239,68,110,0.1)] text-danger border border-[rgba(239,68,110,0.2)] rounded-xl px-6 py-3 font-app font-bold text-[0.95rem] cursor-pointer transition-all duration-[0.25s] hover:bg-danger hover:text-white hover:border-danger"
          onClick={onResetMetrics}
        >
          Restablecer Métricas
        </button>
      </div>
    </div>
  )
}
