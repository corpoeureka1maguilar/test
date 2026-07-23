// Almacenamiento de secretos del kiosko (password del usuario de servicio).
//
// La password NO se persiste en texto plano: se cifra con AES-GCM usando un
// CryptoKey NO exportable guardado en IndexedDB. Alguien con acceso físico y
// DevTools ve solo el ciphertext; el material de la clave nunca es legible
// porque la clave se genera con extractable=false.
//
// En contextos no seguros (http://IP-LAN) crypto.subtle no existe: se cae a
// una ofuscación base64 con advertencia — el kiosko debe servirse por
// localhost o HTTPS para tener cifrado real.

const DB_NAME = 'autopay-secure'
const STORE = 'keys'
const DEVICE_KEY_ID = 'device-key'
const SECRET_PREFIX = 'autopay-secret:'

const hasSubtle = typeof crypto !== 'undefined' && Boolean(crypto.subtle)

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(new Error(req.error?.message ?? 'IndexedDB error'))
  })
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(new Error(req.error?.message ?? 'IndexedDB error'))
  })
}

async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  const db = await openDb()
  try {
    const existing = await idbRequest<CryptoKey | undefined>(
      db.transaction(STORE, 'readonly').objectStore(STORE).get(DEVICE_KEY_ID)
    )
    if (existing) return existing

    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    await idbRequest(db.transaction(STORE, 'readwrite').objectStore(STORE).put(key, DEVICE_KEY_ID))
    return key
  } finally {
    db.close()
  }
}

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes))

const fromBase64 = (b64: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

interface StoredSecret {
  v: 0 | 1        // 0 = base64 sin cifrar (contexto no seguro), 1 = AES-GCM
  iv?: string
  data: string
}

export async function saveSecret(name: string, value: string): Promise<void> {
  let stored: StoredSecret

  if (hasSubtle) {
    const key = await getOrCreateDeviceKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value))
    stored = { v: 1, iv: toBase64(iv), data: toBase64(new Uint8Array(cipher)) }
  } else {
    console.warn('[secureStorage] Contexto no seguro: el secreto se guarda sin cifrar. Sirva el kiosko por localhost o HTTPS.')
    stored = { v: 0, data: toBase64(new TextEncoder().encode(value)) }
  }

  localStorage.setItem(SECRET_PREFIX + name, JSON.stringify(stored))
}

export async function loadSecret(name: string): Promise<string> {
  const raw = localStorage.getItem(SECRET_PREFIX + name)
  if (!raw) return ''

  try {
    const stored = JSON.parse(raw) as StoredSecret
    if (stored.v === 0) return new TextDecoder().decode(fromBase64(stored.data))

    if (!hasSubtle || !stored.iv) return ''
    const key = await getOrCreateDeviceKey()
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(stored.iv) },
      key,
      fromBase64(stored.data)
    )
    return new TextDecoder().decode(plain)
  } catch (err) {
    console.error(`[secureStorage] No se pudo descifrar el secreto "${name}":`, err)
    return ''
  }
}

export function deleteSecret(name: string): void {
  localStorage.removeItem(SECRET_PREFIX + name)
}
