import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomInt, randomUUID } from 'node:crypto'
import { get, put, del } from '../server/storage.ts'
import { validateSubmission, HttpError } from '../server/validation.ts'
import { readRecords, updateRecords, claimOnce, limit, csvFor, publicRecord, publicSponsors, type ReviewRecord } from '../server/store.ts'
import { createSponsorChallenge, confirmSponsorCode } from '../server/sponsor-auth.ts'
import { normalizedEmail, requireEmailVerification } from '../server/email-verification.ts'
import { socialLink } from '../server/social.ts'
import { addAdminContribution } from '../server/admin-entry.ts'
import { checkSubmissionLimit } from '../server/submission-limit.ts'
import { checkOrigin, requireAdmin, adminSession, signToken, verifyToken, namespace, hash } from '../server/security.ts'
import { sendEmail } from '../server/email.ts'
import { notify } from '../server/notifications.ts'
import { reviewRequest } from '../server/review.ts'
import { adminUsers, editUser, editContribution, contributionVersion, deleteUser } from '../server/users.ts'
import { requestAdminLogin } from '../server/admin-login.ts'

type Request = IncomingMessage & { body?: unknown }
function json(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(value))
}
export default async function handler(req: Request, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  try {
    const url = new URL(req.url || '/', 'https://localhost')
    const action = url.searchParams.get('action')
    if (req.method === 'GET') {
      if (action === 'public') {
        const { records } = await readRecords()
        res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=60')
        return json(res, 200, { sponsors: publicSponsors(records), contributions: records.filter(record => record.status === 'approved').map(publicRecord) })
      }
      if (action === 'check-user-id') {
        const userId = (url.searchParams.get('user_id') || '').trim().toLowerCase()
        if (!/^[a-z0-9._]{1,30}$/.test(userId)) throw new HttpError(400, 'Enter a valid username.')
        const { records } = await readRecords()
        return json(res, 200, { exists: records.some(record => record.user_id.toLowerCase() === userId) })
      }
      if (action === 'photo') {
        const { records } = await readRecords()
        const record = records.find(item => item.request_id === url.searchParams.get('id'))
        if (!record || !record.photo_path || (record.status !== 'approved' && !adminSession(req.headers.cookie))) throw new HttpError(404, 'Photo not found.')
        const blob = await get(record.photo_path, { access: 'private', useCache: false })
        if (!blob || blob.statusCode !== 200) throw new HttpError(404, 'Photo not found.')
        res.setHeader('Content-Type', record.photo_type)
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
        if (record.status === 'approved') res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=60')
        return res.end(Buffer.from(await new Response(blob.stream).arrayBuffer()))
      }
      requireAdmin(req.headers.cookie)
      const { records } = await readRecords()
      if (action === 'export') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', 'attachment; filename="sponsor-admin.csv"')
        return res.end('\uFEFF' + csvFor(records, true))
      }
      if (action === 'admin') return json(res, 200, records.map(record => ({ ...record, version: contributionVersion(record) })))
      if (action === 'users') return json(res, 200, adminUsers(records))
      throw new HttpError(404, 'Not found.')
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); throw new HttpError(405, 'Method not allowed.') }
    checkOrigin(req.headers.origin, req.headers.host)
    if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Send JSON data.')
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new HttpError(400, 'Invalid request.')
    if (JSON.stringify(req.body).length > 1450000) throw new HttpError(413, 'The photo is too large.')
    const input = req.body as Record<string, unknown>
    if (action === 'send-email-code') {
      const email = normalizedEmail(input.email)
      const requestId = typeof input.request_id === 'string' ? input.request_id : ''
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new HttpError(400, 'Reload the form and try again.')
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0]
      await limit(`email-code-ip:${ip}`, 60)
      await limit(`email-code-address:${email}`, 60)
      const code = String(randomInt(100000, 1000000))
      await sendEmail(email, 'Your Yali sponsorship verification code', `Your verification code is ${code}.\n\nUse it within 10 minutes to continue your sponsorship. Never share this code. If you did not request it, ignore this email.\n\nYali`)
      return json(res, 200, { challenge: createSponsorChallenge('email', requestId, code, email) })
    }
    if (action === 'check-verified-user') {
      const email = normalizedEmail(input.email)
      requireEmailVerification(input.verification, input.request_id, email)
      const userId = typeof input.user_id === 'string' ? input.user_id.trim().toLowerCase() : ''
      if (!/^[a-z0-9._]{1,30}$/.test(userId)) throw new HttpError(400, 'Enter a valid username.')
      const account = (await readRecords()).records.find(row => row.user_id.toLowerCase() === userId)
      return json(res, 200, { exists: Boolean(account), matchesEmail: !account || account.email === email, needsAdminEmail: Boolean(account && !account.email) })
    }
    if (action === 'verify-sponsor-code') {
      const challenge = typeof input.challenge === 'string' ? input.challenge : ''
      const data = verifyToken(challenge, 'sponsor-code')
      if (!data) throw new HttpError(400, 'This code has expired. Request a new one.')
      let attemptAllowed = false
      for (let attempt = 0; attempt < 5; attempt++) {
        if (await claimOnce(`sponsor-code-attempts/${hash(data.nonce)}/${attempt}`)) { attemptAllowed = true; break }
      }
      if (!attemptAllowed) throw new HttpError(429, 'Too many attempts. Request a new code.')
      return json(res, 200, { verification: confirmSponsorCode(challenge, String(input.code || '')) })
    }
    if (action === 'login-link') {
      return json(res, 200, await requestAdminLogin(req.headers.origin!))
    }
    if (action === 'login') {
      const token = typeof input.token === 'string' ? input.token : ''
      const data = verifyToken(token, 'login')
      if (!data || !await claimOnce(`used-logins/${hash(data.nonce)}`)) throw new HttpError(401, 'This sign-in link is expired or already used. Request another.')
      res.setHeader('Set-Cookie', `sponsor_admin=${signToken('session', 28800)}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`)
      return json(res, 200, { ok: true })
    }
    if (action === 'logout') {
      res.setHeader('Set-Cookie', 'sponsor_admin=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0')
      return json(res, 200, { ok: true })
    }
    if (action === 'submit') {
      const current = (await readRecords()).records
      const userId = typeof input.user_id === 'string' ? input.user_id.trim().toLowerCase() : ''
      const existing = current.find(item => item.request_id === input.request_id)
      if (existing) {
        if (existing.user_id !== userId) throw new HttpError(409, 'Please reload the form.')
        requireEmailVerification(input.verification, input.request_id, existing.email)
        return json(res, 200, { request_id: existing.request_id, status: existing.status, emailSent: existing.pending_email === 'sent' })
      }
      const account = current.find(record => record.user_id.toLowerCase() === userId)
      requireEmailVerification(input.verification, input.request_id, account?.email || normalizedEmail(input.email))
      const submission = validateSubmission(account ? { ...input, name: account.name, email: account.email, social_id: account.social_id, avatar_icon: account.avatar_icon || '', photo: '' } : { ...input, social_id: socialLink(input.social_platform, input.social_id), avatar_icon: input.avatar_icon ?? 'heart' })
      let photoPath = ''
      let saved = false
      try {
        if (submission.photo) {
          const photo = await put(`${namespace()}/photos/${submission.request_id}.${submission.photo.extension}`, submission.photo.bytes, {
            access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: submission.photo.type,
          })
          photoPath = photo.pathname
        }
        const record: ReviewRecord = {
          request_id: submission.request_id, user_id: submission.user_id, name: submission.name,
          email: submission.email, social_id: submission.social_id, amount: submission.amount,
          paid_at: submission.paid_at, transaction_id: submission.transaction_id, notes: submission.notes,
          photo_path: account?.photo_path || photoPath, photo_type: account?.photo_type || submission.photo?.type || '', status: 'pending',
          submitted_at: submission.paid_at, reviewed_at: '', pending_email: '', decision_email: '',
          returning_user_verified: account ? 'yes' : '',
          avatar_icon: submission.avatar_icon,
        }
        await updateRecords(records => {
          const latestAccount = records.find(item => item.user_id.toLowerCase() === record.user_id)
          if (account && !latestAccount) throw new HttpError(409, 'Your profile changed. Reload the form and verify again.')
          if (latestAccount) {
            requireEmailVerification(input.verification, record.request_id, latestAccount.email)
            for (const key of ['name', 'email', 'social_id', 'photo_path', 'photo_type'] as const) record[key] = latestAccount[key]
            record.avatar_icon = latestAccount.avatar_icon || ''
          }
          if (records.some(item => item.transaction_id.toLowerCase() === record.transaction_id.toLowerCase())) throw new HttpError(409, 'This payment reference has already been submitted.')
          checkSubmissionLimit(records, record.email)
          records.push(record)
        })
        saved = true
        const emailSent = await notify(record, 'pending_email')
        return json(res, 201, { request_id: record.request_id, status: 'pending', emailSent })
      } finally {
        if (!saved && photoPath) {
          // A timed-out write may already be committed. Never delete its photo on an uncertain result.
          try {
            const latest = await readRecords()
            if (!latest.records.some(item => item.photo_path === photoPath)) await del(photoPath)
          } catch { /* Retain the photo if persistence cannot be confirmed. */ }
        }
      }
    }
    requireAdmin(req.headers.cookie)
    if (action === 'delete-user') {
      const result = await updateRecords(records => deleteUser(records, input))
      try {
        const latest = (await readRecords()).records
        for (const path of result.photos) if (!latest.some(row => row.photo_path === path)) await del(path)
      } catch { /* Deleted profiles are inaccessible; unused image cleanup may be retried separately. */ }
      return json(res, 200, { deleted: result.deleted })
    }
    if (action === 'admin-add') return json(res, 200, await updateRecords(records => addAdminContribution(records, input)))
    if (action === 'edit-user') {
      let photoPath = ''
      try {
        const validated = editUser((await readRecords()).records, input)
        if (validated.photo) {
          const photo = await put(`${namespace()}/photos/${randomUUID()}.${validated.photo.extension}`, validated.photo.bytes, {
            access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: validated.photo.type,
          })
          photoPath = photo.pathname
        }
        await updateRecords(records => editUser(records, input, photoPath))
        return json(res, 200, { ok: true })
      } finally {
        if (photoPath) {
          try { if (!(await readRecords()).records.some(item => item.photo_path === photoPath)) await del(photoPath) }
          catch { /* Retain a possibly committed photo if persistence cannot be confirmed. */ }
        }
      }
    }
    if (action === 'edit-contribution') {
      await updateRecords(records => editContribution(records, input))
      return json(res, 200, { ok: true })
    }
    if (action === 'review') {
      if (typeof input.request_id !== 'string' || !['approved', 'rejected', 'revoked'].includes(String(input.status))) throw new HttpError(400, 'Choose approve, reject or revoke.')
      const record = await updateRecords(records => {
        const record = records.find(item => item.request_id === input.request_id)
        if (!record) throw new HttpError(404, 'Request not found.')
        reviewRequest(record, input.status as 'approved' | 'rejected' | 'revoked')
        return { ...record }
      })
      const emailSent = await notify(record, 'decision_email')
      return json(res, 200, { status: record.status, emailSent })
    }
    if (action === 'retry-email') {
      const record = (await readRecords()).records.find(item => item.request_id === input.request_id)
      if (!record) throw new HttpError(404, 'Request not found.')
      const emailSent = await notify(record, record.status === 'pending' ? 'pending_email' : 'decision_email')
      return json(res, 200, { emailSent })
    }
    throw new HttpError(404, 'Not found.')
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.retryAfter) res.setHeader('Retry-After', error.retryAfter)
      return json(res, error.status, { error: error.message, code: error.code, retryAfter: error.retryAfter })
    }
    console.error('Sponsorship request failed:', error instanceof Error ? error.name : 'UnknownError')
    return json(res, 503, { error: 'We couldn’t complete this request. Please try again shortly.' })
  }
}
