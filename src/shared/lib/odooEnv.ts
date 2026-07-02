export interface EnvCredentials {
  url: string
  db: string
  password: string
}

export interface OdooEnvService {
  setupConnection(data: Partial<EnvCredentials>): void
  authenticate(username: string): Promise<number>
  disconnect(): void
  callMethod<T>(model: string, method: string, args?: unknown[], kwargs?: object, abortable?: boolean): Promise<T>
  callMethodWithoutLimit<T>(model: string, method: string, args?: unknown[], kwargs?: object, abortable?: boolean): Promise<T>
  callMethodCached<T>(model: string, method: string, args?: unknown[], kwargs?: object): Promise<T>
  abortAll(): void
  readonly baseUrl: string
  readonly uid: number
}

// En dev: proxy de Vite en la misma origin (/jsonrpc relativo)
// En prod con app central: proxy local en localhost:9191
const PROXY_BASE = import.meta.env.VITE_PROXY_BASE ?? ''
const TIMEOUT = 36_000

// Cancelación deliberada (abortAll / navegación). Es un Error real para no
// romper los handlers que hacen `instanceof Error` sobre lo que reciben.
export class RpcAbortedError extends Error {
  constructor() {
    super('Operación cancelada')
    this.name = 'RpcAbortedError'
  }
}

// Error devuelto por el servidor de Odoo. Conserva el nombre de la excepción
// Python (p. ej. 'odoo.exceptions.MissingError') para que los callers puedan
// distinguir errores permanentes (registro borrado) de transitorios (red).
export class OdooServerError extends Error {
  readonly odooException: string
  constructor(message: string, odooException = '') {
    super(message)
    this.name = 'OdooServerError'
    this.odooException = odooException
  }
}

// Un MissingError significa que el registro fue eliminado en Odoo: reintentar
// jamás lo va a resucitar. El fallback por texto cubre servidores que no
// mandan data.name (mensaje en inglés o español según el idioma del server).
export function isMissingRecordError(err: unknown): boolean {
  if (!(err instanceof OdooServerError)) return false
  return (
    err.odooException.includes('MissingError') ||
    /record does not exist|registro no existe/i.test(err.message)
  )
}

interface RpcError {
  data?: { message?: string; name?: string }
  message?: string
}

interface RpcResponse<T> {
  result?: T
  error?: RpcError
}

class JSONRpcEnv implements OdooEnvService {
  readonly #rpcUrl = `${PROXY_BASE}/jsonrpc`
  #url = ''
  #uid = 0
  #db = ''
  #password = ''
  #controllers: Set<AbortController> = new Set()
  #inFlight = new Map<string, Promise<unknown>>()

  get baseUrl(): string {
    return window.location.origin
  }

  get uid(): number {
    return this.#uid
  }

  setupConnection(data: Partial<EnvCredentials>) {
    if (data.url) this.#url = data.url
    if (data.db) this.#db = data.db
    if (data.password !== undefined) this.#password = data.password
  }

  disconnect() {
    this.#db = ''
    this.#password = ''
    this.#uid = 0
  }

  abortAll() {
    for (const controller of this.#controllers) controller.abort()
    this.#controllers.clear()
  }

  #extractRpcError(error: RpcError, fallback: string): string {
    let message = error.data?.message ?? error.message ?? fallback
    if (message.includes('\n')) {
      const lines = message.split('\n')
      message = lines.find(l => l.includes('Exception:') || l.includes('Error:')) ?? lines[0]
    }
    return message
  }

  async #post(params: object, abortable = true): Promise<unknown> {
    const controller = new AbortController()
    let timedOut = false
    const id = setTimeout(() => { timedOut = true; controller.abort() }, TIMEOUT)
    if (abortable) this.#controllers.add(controller)

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (this.#url) {
        headers['x-odoo-target'] = this.#url
      }

      const res = await window.fetch(this.#rpcUrl, {
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', method: 'call_kw', params }),
        headers,
        credentials: 'include',
        signal: controller.signal
      })
      clearTimeout(id)
      if (!res.ok) {
        const msg = `${res.status} ${res.statusText}`
        console.error('[OdooEnv] HTTP error:', msg)
        throw new Error(msg)
      }
      return res.json()
    } catch (error: unknown) {
      clearTimeout(id)
      if (error instanceof RpcAbortedError || (error as Error)?.name === 'AbortError') {
        // El timeout también aborta el fetch: distinguirlo para que el usuario
        // vea un mensaje útil y no una "cancelación" que nunca pidió
        if (timedOut) {
          console.error(`[OdooEnv] Timeout tras ${TIMEOUT / 1000}s`)
          throw new Error('El servidor no respondió a tiempo. Verifique la conexión e intente de nuevo.')
        }
        throw new RpcAbortedError()
      }
      const msg = error instanceof Error ? error.message : 'No se pudo contactar al servidor'
      console.error('[OdooEnv] Network error:', msg)
      throw new Error(msg)
    } finally {
      if (abortable) this.#controllers.delete(controller)
    }
  }

  async #callRpc<T>(model: string, method: string, args: unknown[], kwargs: object, abortable: boolean): Promise<T> {
    const response = await this.#post({
      service: 'object',
      method: 'execute_kw',
      args: [this.#db, this.#uid, this.#password, model, method, args, kwargs]
    }, abortable) as RpcResponse<T>

    console.debug(`[RPC] ${model}.${method}`, { args, kwargs, result: response.result })

    if (response.error) {
      console.error(`[OdooRPC] Error en ${model}.${method}`, response.error)
      throw new OdooServerError(
        this.#extractRpcError(response.error, 'Error interno de Odoo (RPC)'),
        response.error.data?.name ?? ''
      )
    }

    return response.result as T
  }

  async callMethod<T>(
    model: string,
    method: string,
    args: unknown[] = [],
    kwargs: object = {},
    abortable = true
  ): Promise<T> {
    if (!this.#db) throw new Error('No se pudo establecer conexión: BD no configurada')
    return this.#callRpc<T>(model, method, args, kwargs, abortable)
  }

  // Backwards compat — callers in eu_fex_ppal that bypass the DB guard
  async callMethodWithoutLimit<T>(
    model: string,
    method: string,
    args: unknown[] = [],
    kwargs: object = {},
    abortable = true
  ): Promise<T> {
    return this.#callRpc<T>(model, method, args, kwargs, abortable)
  }

  callMethodCached<T>(
    model: string,
    method: string,
    args: unknown[] = [],
    kwargs: object = {}
  ): Promise<T> {
    const key = JSON.stringify({ model, method, args, kwargs })
    const existing = this.#inFlight.get(key)
    if (existing) return existing as Promise<T>

    const promise = this.callMethod<T>(model, method, args, kwargs, false)
      .finally(() => this.#inFlight.delete(key))

    this.#inFlight.set(key, promise)
    return promise
  }

  async authenticate(username: string): Promise<number> {
    console.info(`[OdooEnv] Autenticando: ${username}`)

    const response = await this.#post({
      service: 'common',
      method: 'login',
      args: [this.#db, username, this.#password]
    }) as RpcResponse<number>

    if (response.error) throw new Error(this.#extractRpcError(response.error, 'Error de inicio de sesión'))

    if (!response.result) {
      throw new OdooServerError('Access Denied (Credenciales incorrectas o base de datos no configurada)', 'odoo.exceptions.AccessDenied')
    }

    this.#uid = response.result as number
    console.info(`[OdooEnv] Autenticado, uid=${this.#uid}`)
    return this.#uid
  }
}

export const odooEnv = new JSONRpcEnv()
