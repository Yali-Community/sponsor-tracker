import { claimOnce } from './store.ts'
import { del } from './storage.ts'
import { hash, namespace, signToken } from './security.ts'
import { sendEmail } from './email.ts'
import { HttpError } from './validation.ts'

export async function requestAdminLogin(origin: string, dependencies = { claimOnce, del, sendEmail }, now = Date.now()) {
  const email = process.env.ADMIN_EMAIL
  if (!email) throw new HttpError(503, 'Admin email is not configured.')
  const token = signToken('login', 600)
  const path = `limits/${hash('admin-login-resend')}/${Math.floor(now / 60000)}`
  const retryAfter = 60 - Math.floor(now / 1000) % 60
  if (!await dependencies.claimOnce(path)) {
    const error = new HttpError(429, `A sign-in link was recently requested. Check your inbox or spam folder, or try again in ${retryAfter} seconds.`)
    error.retryAfter = retryAfter
    throw error
  }
  try {
    await dependencies.sendEmail(email, 'Sign in to Yali Sponsors admin', `Open this link within 10 minutes to review sponsorships:\n\n${origin}/admin.html#token=${token}\n\nIf you did not request this link, you can ignore it.`)
  } catch {
    try { await dependencies.del(`${namespace()}/${path}`) } catch { /* The bounded cooldown expires within a minute. */ }
    throw new HttpError(503, 'Could not send the sign-in email. Please try again shortly.')
  }
  return { message: 'A sign-in link has been sent to the admin email. Check your inbox or spam folder.', retryAfter }
}
