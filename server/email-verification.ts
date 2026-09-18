import { requireSponsorVerification } from './sponsor-auth.ts'
import { HttpError } from './validation.ts'

export function normalizedEmail(value: unknown) {
  if (typeof value !== 'string' || value.trim().length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim())) throw new HttpError(400, 'Enter a valid email address.')
  return value.trim().toLowerCase()
}
export function requireEmailVerification(token: unknown, requestId: unknown, email: string) {
  try { requireSponsorVerification(token, 'email', requestId, email) }
  catch { throw new HttpError(409, 'Verify your email before continuing. Existing usernames need their saved email address.', 'EMAIL_VERIFICATION_REQUIRED') }
}
