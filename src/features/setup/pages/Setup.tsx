import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '@/shared/stores/config'
import { useUIStore } from '@/shared/stores/ui'
import { odooEnv } from '@/shared/lib/odooEnv'
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
    configToken: '',
    adminPin: ''
  })

  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (config.isConfigured) {
      setIsConnected(true)
    }
  }, [config])

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleConnect = async () => {
    if (!form.odooUrl || !form.odooDb || !form.serviceUser || !form.servicePassword) {
      pushToast('error', 'Por favor completa todos los campos de Odoo')
      return
    }

    setLoading(true)
    try {
      // Configurar conexión temporal para verificar y obtener estaciones
      odooEnv.setupConnection({
        url: form.odooUrl,
        db: form.odooDb,
        password: form.servicePassword
      })
      await odooEnv.authenticate(form.serviceUser)
      
      setIsConnected(true)
      pushToast('success', 'Conexión exitosa con Odoo')
    } catch (err) {
      pushToast('error', `Error de conexión: ${(err as Error).message}`)
      setIsConnected(false)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isConnected) {
      pushToast('error', 'Primero debés verificar la conexión con Odoo')
      return
    }
    if (!config.isConfigured && !form.configToken.trim()) {
      pushToast('error', 'Ingresá el token de configuración generado en Odoo')
      return
    }
    if (form.adminPin.length < 4) {
      pushToast('error', 'El PIN debe tener al menos 4 dígitos')
      return
    }

    setLoading(true)
    try {
      await saveConfig(form)
      pushToast('success', 'Configuración guardada correctamente')
      navigate('/')
    } catch (err) {
      pushToast('error', `Error al guardar: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="kiosk-container">
      <h1 className={styles.title}>Configuración del kiosco</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <h3 style={{ margin: '0.5rem 0 1rem 0', color: '#64748b', fontSize: '1.1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
          1. Conexión con Odoo
        </h3>
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
          <input type="password" value={form.servicePassword} onChange={set('servicePassword')} required />
        </label>

        <button type="button" className="btn btn-secondary" onClick={handleConnect} style={{ margin: '0.5rem 0 1.5rem 0' }}>
          {isConnected ? '✓ Conexión Verificada' : 'Conectar y Buscar Estaciones'}
        </button>

        {isConnected && (
          <>
            <h3 style={{ margin: '1rem 0', color: '#64748b', fontSize: '1.1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              2. Vincular Estación
            </h3>

            {config.isConfigured && config.stationName && (
              <div className={styles.stationBadge}>
                Caja vinculada: <strong>{config.stationName}</strong>
              </div>
            )}

            <label>Token de configuración {config.isConfigured && '(opcional, para re-vincular a otra caja)'}
              <input
                type="text"
                value={form.configToken}
                onChange={set('configToken')}
                placeholder="Token generado en Odoo (válido 30 min)"
                required={!config.isConfigured}
              />
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

            <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>Guardar y Finalizar</button>
          </>
        )}
      </form>
    </div>
  )
}

