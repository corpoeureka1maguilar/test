import type { TerminalConfigForm } from '../hooks/useTerminalConfig'

interface Props {
  form: TerminalConfigForm
  isTerminalUnlocked: boolean
  onFieldChange: (field: keyof TerminalConfigForm) => (e: React.ChangeEvent<HTMLInputElement>) => void
  onSubmit: (e: React.FormEvent) => void
  onRequestUnlock: () => void
  onReloadCache: () => void
}

const FIELD_LABEL = 'flex flex-col gap-2 text-[1rem] font-bold text-text-muted uppercase tracking-[0.06em] text-left [&>input]:mt-1'

export function TerminalTab({ form, isTerminalUnlocked, onFieldChange, onSubmit, onRequestUnlock, onReloadCache }: Props) {
  return (
    <div className="flex flex-col items-center gap-8 w-full">
      <form className="flex flex-col items-center w-full max-w-[900px] bg-panel border border-surface-border p-6 rounded-app shadow-app animate-scaleIn" onSubmit={onSubmit}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-4 w-full">
          <label className={FIELD_LABEL}>URL de Odoo
            <input type="text" value={form.odooUrl} onChange={onFieldChange('odooUrl')} placeholder="https://mi-empresa.odoo.com" required disabled={!isTerminalUnlocked} />
          </label>
          <label className={FIELD_LABEL}>Base de datos
            <input type="text" value={form.odooDb} onChange={onFieldChange('odooDb')} placeholder="mi_base" required disabled={!isTerminalUnlocked} />
          </label>
          <label className={FIELD_LABEL}>Usuario de servicio
            <input type="text" value={form.serviceUser} onChange={onFieldChange('serviceUser')} placeholder="kiosco@empresa.com" required disabled={!isTerminalUnlocked} />
          </label>
          <label className={FIELD_LABEL}>Contraseña de Odoo
            <input type="password" value={form.servicePassword} onChange={onFieldChange('servicePassword')} required disabled={!isTerminalUnlocked} />
          </label>
          <label className={FIELD_LABEL}>URL Impresora Fiscal
            <input type="text" value={form.printerUrl} onChange={onFieldChange('printerUrl')} required disabled={!isTerminalUnlocked} />
          </label>
          <label className={FIELD_LABEL}>Modelo Impresora Fiscal
            <input type="text" value={form.printerModel} onChange={onFieldChange('printerModel')} placeholder="Ej. HKA, Bixolon, Bematech..." disabled={!isTerminalUnlocked} />
          </label>
        </div>
        {isTerminalUnlocked && (
          <p className="mt-5 text-[0.85rem] text-text-muted leading-[1.5] max-w-[600px] text-center">
            El acceso administrativo se valida contra la contraseña de administrador
            del cajero en Odoo. Esta terminal no guarda un PIN propio.
          </p>
        )}
        {isTerminalUnlocked ? (
          <button type="submit" className="btn btn-accent mt-6 w-full max-w-[380px]">
            Guardar Configuración
          </button>
        ) : (
          <button type="button" className="btn btn-secondary mt-6 w-full max-w-[380px]" onClick={onRequestUnlock}>
            Modificar Configuración
          </button>
        )}
      </form>

      <div className="bg-panel border border-surface-border p-6 rounded-app shadow-app flex flex-col items-center text-center gap-3 w-full max-w-[900px] animate-scaleIn">
        <h3 className="text-[1.2rem] font-extrabold text-text">Caché del Sistema</h3>
        <p className="text-[0.85rem] text-text-muted leading-[1.5] max-w-[600px]">
          Descarga la información más reciente de productos y métodos de pago desde Odoo para actualizar el caché local.
        </p>
        <button
          type="button"
          className="btn btn-secondary w-full max-w-[380px]"
          onClick={onReloadCache}
        >
          Recargar Caché
        </button>
      </div>
    </div>
  )
}
