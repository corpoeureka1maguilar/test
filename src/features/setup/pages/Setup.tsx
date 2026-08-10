import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '@/shared/stores/config'
import { useUIStore } from '@/shared/stores/ui'
import { odooEnv } from '@/shared/lib/odooEnv'

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
    configToken: ''
  })

  // Si el kiosko ya está configurado (config cargada desde disco), la conexión
  // se da por verificada sin pedir que el usuario la repita manualmente.
  const [manuallyVerified, setManuallyVerified] = useState(false)
  const isConnected = config.isConfigured || manuallyVerified

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
      
      setManuallyVerified(true)
      pushToast('success', 'Conexión exitosa con Odoo')
    } catch (err) {
      pushToast('error', `Error de conexión: ${(err as Error).message}`)
      setManuallyVerified(false)
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
      <h1 className="text-[2rem] font-bold mb-8">Configuración del kiosco</h1>

      <form
        className="flex flex-col gap-5 max-w-[600px]"
        onSubmit={(e) => {
          void handleSubmit(e)
        }}
      >
        <h3 className="text-text-muted text-[1.1rem] border-b border-surface-border pb-2 mt-2 mb-4">
          1. Conexión con Odoo
        </h3>
        <label className="flex flex-col gap-[0.4rem] text-base font-semibold">URL de Odoo
          <input type="text" value={form.odooUrl} onChange={set('odooUrl')} placeholder="https://mi-empresa.odoo.com" required />
        </label>
        <label className="flex flex-col gap-[0.4rem] text-base font-semibold">Base de datos
          <input type="text" value={form.odooDb} onChange={set('odooDb')} placeholder="mi_base" required />
        </label>
        <label className="flex flex-col gap-[0.4rem] text-base font-semibold">Usuario de servicio
          <input type="text" value={form.serviceUser} onChange={set('serviceUser')} placeholder="kiosco@empresa.com" required />
        </label>
        <label className="flex flex-col gap-[0.4rem] text-base font-semibold">Contraseña
          <input type="password" value={form.servicePassword} onChange={set('servicePassword')} required />
        </label>

        <button
          type="button"
          className="btn btn-secondary mt-2 mb-6"
          onClick={() => {
            void handleConnect()
          }}
        >
          {isConnected ? '✓ Conexión Verificada' : 'Conectar y Buscar Estaciones'}
        </button>

        {isConnected && (
          <>
            <h3 className="text-text-muted text-[1.1rem] border-b border-surface-border pb-2 my-4">
              2. Vincular Estación
            </h3>

            {config.isConfigured && config.stationName && (
              <div className="bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] rounded-lg px-4 py-3 text-[0.95rem]">
                Caja vinculada: <strong>{config.stationName}</strong>
              </div>
            )}

            <label className="flex flex-col gap-[0.4rem] text-base font-semibold">Token de configuración {config.isConfigured && '(opcional, para re-vincular a otra caja)'}
              <input
                type="text"
                value={form.configToken}
                onChange={set('configToken')}
                placeholder="Token generado en Odoo (válido 30 min)"
                required={!config.isConfigured}
              />
            </label>

            <label className="flex flex-col gap-[0.4rem] text-base font-semibold">URL impresora fiscal
              <div className="flex gap-2 items-center">
                <input type="text" value={form.printerUrl} onChange={set('printerUrl')} required className="flex-1" />
                <button type="button" className="btn btn-secondary whitespace-nowrap" onClick={() => navigate('/test-printer')}>
                  Probar conexion
                </button>
              </div>
            </label>
            <label className="flex flex-col gap-[0.4rem] text-base font-semibold">Modelo impresora fiscal
              <input type="text" value={form.printerModel} onChange={set('printerModel')} placeholder="Ej. HKA, Bixolon, Bematech..." />
            </label>
            <p className="text-[0.9rem] text-text-muted leading-[1.5] bg-panel border border-surface-border rounded-lg px-4 py-3">
              El acceso administrativo del kiosco se valida con la contraseña de
              administrador del cajero en Odoo. Esta terminal no guarda un PIN propio.
            </p>

            <button type="submit" className="btn btn-primary mt-6">Guardar y Finalizar</button>
          </>
        )}
      </form>
    </div>
  )
}

