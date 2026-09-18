import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { HttpError } from './validation.ts'

export function namespace() {
  const environment = process.env.VERCEL_ENV || 'development'
  return environment === 'production' ? 'production' : `${environment}/${createHmac('sha256', 'sponsor-namespace').update(process.env.VERCEL_GIT_COMMIT_REF || 'local').digest('hex').slice(0, 16)}`
}
function secret() {
  const value = process.env.ADMIN_SESSION_SECRET
  if (!value || value.length < 32) throw new HttpError(503, 'Admin sign-in is not configured yet.')
  return value
}
export function hash(value: string) { return createHmac('sha256', secret()).update(value).digest('hex') }
type TokenKind = 'login' | 'session' | 'sponsor-code' | 'sponsor-verified'
export function signToken(kind: TokenKind, seconds: number, details: { user_id?: string; request_id?: string; code_hash?: string; account_key?: string } = {}) {
  const payload = Buffer.from(JSON.stringify({ ...details, kind, expires: Date.now() + seconds * 1000, nonce: randomUUID(), scope: namespace() })).toString('base64url')
  return `${payload}.${hash(payload)}`
}
export function verifyToken(token: string, kind: TokenKind) {
  try {
    const [payload, signature, extra] = token.split('.')
    if (extra || !payload || !/^[a-f0-9]{64}$/.test(signature)) return null
    if (!timingSafeEqual(Buffer.from(hash(payload)), Buffer.from(signature))) return null
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (data.kind !== kind || data.scope !== namespace() || data.expires <= Date.now() || typeof data.nonce !== 'string') return null
    return data as { nonce: string; expires: number; user_id?: string; request_id?: string; code_hash?: string; account_key?: string }
  } catch { return null }
}
export function adminSession(cookie = '') {
  const value = cookie.split(';').map(part => part.trim()).find(part => part.startsWith('sponsor_admin='))?.slice(14)
  return Boolean(value && verifyToken(value, 'session'))
}
export function requireAdmin(cookie = '') {
  if (!adminSession(cookie)) throw new HttpError(401, 'Sign in to review sponsor requests.')
}
export function checkOrigin(origin: string | undefined, host: string | undefined) {
  if (!origin || !host) throw new HttpError(403, 'Open the form on this website before submitting.')
  try {
    const url = new URL(origin)
    if (url.host !== host || (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1')) throw new Error()
  } catch { throw new HttpError(403, 'This request did not come from this website.') }
}
