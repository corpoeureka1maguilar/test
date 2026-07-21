import type { TerminalConfigForm } from '../hooks/useTerminalConfig'
import styles from '../pages/AdvancedMenu.module.css'

interface Props {
  form: TerminalConfigForm
  isTerminalUnlocked: boolean
  onFieldChange: (field: keyof TerminalConfigForm) => (e: React.ChangeEvent<HTMLInputElement>) => void
  onSubmit: (e: React.FormEvent) => void
  onRequestUnlock: () => void
  onReloadCache: () => void
}

export function TerminalTab({ form, isTerminalUnlocked, onFieldChange, onSubmit, onRequestUnlock, onReloadCache }: Props) {
  return (
    <div className={styles.terminalContainer}>
      <form className={styles.configForm} onSubmit={onSubmit}>
        <div className={styles.formGrid}>
          <label className={styles.fieldLabel}>URL de Odoo
            <input type="text" value={form.odooUrl} onChange={onFieldChange('odooUrl')} placeholder="https://mi-empresa.odoo.com" required disabled={!isTerminalUnlocked} />
          </label>
          <label className={styles.fieldLabel}>Base de datos
            <input type="text" value={form.odooDb} onChange={onFieldChange('odooDb')} placeholder="mi_base" required disabled={!isTerminalUnlocked} />
          </label>
          <label className={styles.fieldLabel}>Usuario de servicio
            <input type="text" value={form.serviceUser} onChange={onFieldChange('serviceUser')} placeholder="kiosco@empresa.com" required disabled={!isTerminalUnlocked} />
          </label>
          <label className={styles.fieldLabel}>Contraseña de Odoo
            <input type="password" value={form.servicePassword} onChange={onFieldChange('servicePassword')} required disabled={!isTerminalUnlocked} />
          </label>
          <label className={styles.fieldLabel}>URL Impresora Fiscal
            <input type="text" value={form.printerUrl} onChange={onFieldChange('printerUrl')} required disabled={!isTerminalUnlocked} />
          </label>
          <label className={styles.fieldLabel}>Modelo Impresora Fiscal
            <input type="text" value={form.printerModel} onChange={onFieldChange('printerModel')} placeholder="Ej. HKA, Bixolon, Bematech..." disabled={!isTerminalUnlocked} />
          </label>
          {isTerminalUnlocked && (
            <label className={styles.fieldLabel}>PIN de Administrador (nuevo)
              <input type="password" value={form.adminPin} onChange={onFieldChange('adminPin')} maxLength={6} required placeholder="PIN de 4 a 6 dígitos" />
            </label>
          )}
        </div>
        {isTerminalUnlocked ? (
          <button type="submit" className={`btn btn-accent ${styles.submitBtn}`}>
            Guardar Configuración
          </button>
        ) : (
          <button type="button" className={`btn btn-secondary ${styles.submitBtn}`} onClick={onRequestUnlock}>
            Modificar Configuración
          </button>
        )}
      </form>

      <div className={styles.cacheCard}>
        <h3 className={styles.cacheTitle}>Caché del Sistema</h3>
        <p className={styles.cacheDesc}>
          Descarga la información más reciente de productos y métodos de pago desde Odoo para actualizar el caché local.
        </p>
        <button
          type="button"
          className={`btn btn-secondary ${styles.cacheBtn}`}
          onClick={onReloadCache}
        >
          Recargar Caché
        </button>
      </div>
    </div>
  )
}
