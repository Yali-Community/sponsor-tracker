import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomInt } from 'node:crypto'
import { get, put, del } from '@vercel/blob'
import { validateSubmission, HttpError } from '../server/validation.ts'
import { readRecords, updateRecords, claimOnce, limit, csvFor, publicRecord, publicSponsors, type ReviewRecord } from '../server/store.ts'
import { createSponsorChallenge, confirmSponsorCode, requireSponsorVerification } from '../server/sponsor-auth.ts'
import { checkSubmissionLimit } from '../server/submission-limit.ts'
import { checkOrigin, requireAdmin, adminSession, signToken, verifyToken, namespace, hash } from '../server/security.ts'
import { sendEmail } from '../server/email.ts'
import { notify, deliveryInProgress } from '../server/notifications.ts'

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
        return json(res, 200, { sponsors: publicSponsors(records), contributions: records.filter(record => record.status === 'approved').map(publicRecord) })
      }
      if (action === 'check-user-id') {
        const userId = (url.searchParams.get('user_id') || '').trim().toLowerCase()
        if (!/^[a-z0-9._]{1,30}$/.test(userId)) throw new HttpError(400, 'Enter a valid user ID.')
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
        return res.end(Buffer.from(await new Response(blob.stream).arrayBuffer()))
      }
      requireAdmin(req.headers.cookie)
      const { records } = await readRecords()
      if (action === 'export') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', 'attachment; filename="sponsor-admin.csv"')
        return res.end('\uFEFF' + csvFor(records, true))
      }
      if (action === 'admin') return json(res, 200, records)
      throw new HttpError(404, 'Not found.')
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); throw new HttpError(405, 'Method not allowed.') }
    checkOrigin(req.headers.origin, req.headers.host)
    if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Send JSON data.')
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new HttpError(400, 'Invalid request.')
    if (JSON.stringify(req.body).length > 1450000) throw new HttpError(413, 'The photo is too large.')
    const input = req.body as Record<string, unknown>
    if (action === 'send-sponsor-code') {
      const userId = typeof input.user_id === 'string' ? input.user_id.trim().toLowerCase() : ''
      const requestId = typeof input.request_id === 'string' ? input.request_id : ''
      if (!/^[a-z0-9._]{1,30}$/.test(userId) || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new HttpError(400, 'Check your user ID and reload the form.')
      const account = (await readRecords()).records.find(record => record.user_id.toLowerCase() === userId)
      if (!account) throw new HttpError(404, 'This user ID is available. Enter your profile details to continue.')
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0]
      await limit(`sponsor-code-ip:${ip}`, 60)
      await limit(`sponsor-code-user:${userId}`, 60)
      const code = String(randomInt(100000, 1000000))
      await sendEmail(account.email, 'Your Yali sponsorship verification code', `Your verification code is ${code}.\n\nUse it within 10 minutes to submit another contribution under @${userId}. Never share this code. If you did not request it, ignore this email.\n\nYali`)
      return json(res, 200, { challenge: createSponsorChallenge(userId, requestId, code) })
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
      await limit('admin-login', 300)
      const token = signToken('login', 600)
      const origin = req.headers.origin!
      const adminEmail = process.env.ADMIN_EMAIL
      if (!adminEmail) throw new HttpError(503, 'Admin email is not configured.')
      await sendEmail(adminEmail, 'Sign in to Yali Sponsors admin', `Open this link within 10 minutes to review sponsorships:\n\n${origin}/admin.html#token=${token}\n\nIf you did not request this link, you can ignore it.`)
      return json(res, 200, { message: 'A sign-in link has been sent to the admin email.' })
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
        if (typeof input.email !== 'string' || existing.email !== input.email.trim().toLowerCase()) requireSponsorVerification(input.verification, userId, input.request_id)
        return json(res, 200, { request_id: existing.request_id, status: existing.status, emailSent: existing.pending_email === 'sent' })
      }
      const account = current.find(record => record.user_id.toLowerCase() === userId)
      if (account) requireSponsorVerification(input.verification, userId, input.request_id)
      const submission = validateSubmission(account ? { ...input, name: account.name, email: account.email, social_id: account.social_id, photo: '' } : input)
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
        }
        await updateRecords(records => {
          if (records.some(item => item.user_id.toLowerCase() === record.user_id)) requireSponsorVerification(input.verification, record.user_id, record.request_id)
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
    if (action === 'review') {
      if (typeof input.request_id !== 'string' || !['approved', 'rejected'].includes(String(input.status))) throw new HttpError(400, 'Choose approve or reject.')
      const record = await updateRecords(records => {
        const record = records.find(item => item.request_id === input.request_id)
        if (!record) throw new HttpError(404, 'Request not found.')
        if (record.status !== 'pending' && record.status !== input.status) throw new HttpError(409, 'This request has already been reviewed.')
        if (record.status === 'pending') {
          if (deliveryInProgress(record.pending_email)) throw new HttpError(409, 'The pending email is being sent. Please retry approval in a moment.')
          record.status = input.status as 'approved' | 'rejected'
          record.reviewed_at = new Date().toISOString()
        }
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
