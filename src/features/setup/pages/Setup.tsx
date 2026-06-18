import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '@/shared/stores/config'
import { useUIStore } from '@/shared/stores/ui'
import styles from './Setup.module.css'

export function Setup() {
  const navigate = useNavigate()
  const config = useConfigStore()
  const { saveConfig } = config
  const { pushToast, setLoading } = useUIStore()

  const [form, setForm] = useState({
    odooUrl: config.odooUrl || '',
    odooDb: config.odooDb || '',
    serviceUser: config.serviceUser || '',
    servicePassword: config.servicePassword || '',
    printerUrl: config.printerUrl || 'http://127.0.0.1/ServWebImpresion/api/',
    printerModel: config.printerModel || '',
    adminPin: ''
  })

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.adminPin.length < 4) {
      pushToast('error', 'El PIN debe tener al menos 4 dígitos')
      return
    }

    setLoading(true)
    try {
      await saveConfig(form)
      pushToast('success', 'Configuración guardada')
      navigate('/')
    } catch (err) {
      pushToast('error', `Error al conectar: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="kiosk-container">
      <h1 className={styles.title}>Configuración del kiosco</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label>URL de Odoo
          <input type="text" value={form.odooUrl} onChange={set('odooUrl')} placeholder="https://mi-empresa.odoo.com" required />
        </label>
        <label>Base de datos
          <input type="text" value={form.odooDb} onChange={set('odooDb')} placeholder="mi_base" required />
        </label>
        <label>Usuario de servicio
          <input type="text" value={form.serviceUser} onChange={set('serviceUser')} placeholder="kiosco@empresa.com" required />
        </label>
        <label>Contraseña
          <input type="text" value={form.servicePassword} onChange={set('servicePassword')} required />
        </label>
        <label>URL impresora fiscal
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="text" value={form.printerUrl} onChange={set('printerUrl')} required style={{ flex: 1 }} />
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/test-printer')} style={{ whiteSpace: 'nowrap' }}>
              Probar conexion
            </button>
          </div>
        </label>
        <label>Modelo impresora fiscal
          <input type="text" value={form.printerModel} onChange={set('printerModel')} placeholder="Ej. HKA, Bixolon, Bematech..." />
        </label>
        <label>PIN de administrador (mín. 4 dígitos)
          <input type="password" value={form.adminPin} onChange={set('adminPin')} maxLength={6} required />
        </label>

        <button type="submit" className="btn btn-primary">Guardar y conectar</button>
      </form>
    </div>
  )
}
