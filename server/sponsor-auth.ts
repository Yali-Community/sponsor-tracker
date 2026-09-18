import { timingSafeEqual } from 'node:crypto'
import { hash, signToken, verifyToken } from './security.ts'
import { HttpError } from './validation.ts'

export function createSponsorChallenge(userId: string, requestId: string, code: string) {
  return signToken('sponsor-code', 600, { user_id: userId, request_id: requestId, code_hash: hash(`${requestId}:${code}`) })
}
export function confirmSponsorCode(challenge: string, code: string) {
  const data = verifyToken(challenge, 'sponsor-code')
  if (!data?.user_id || !data.request_id || !data.code_hash || !/^\d{6}$/.test(code)) throw new HttpError(400, 'Check the code or request a new one.')
  const expected = Buffer.from(data.code_hash)
  const actual = Buffer.from(hash(`${data.request_id}:${code}`))
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new HttpError(400, 'That code is incorrect. Please try again.')
  return signToken('sponsor-verified', 600, { user_id: data.user_id, request_id: data.request_id })
}
export function requireSponsorVerification(token: unknown, userId: string, requestId: unknown) {
  const data = typeof token === 'string' ? verifyToken(token, 'sponsor-verified') : null
  if (!data || data.user_id !== userId || data.request_id !== requestId) {
    throw new HttpError(409, 'This username already exists. Verify its saved email to sponsor again.', 'USER_ID_EXISTS')
  }
}
