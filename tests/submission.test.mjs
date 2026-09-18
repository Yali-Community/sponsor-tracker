import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateSubmission } from '../server/validation.ts'
import { signToken, verifyToken, adminSession, checkOrigin } from '../server/security.ts'
import { csvFor, publicRecord } from '../server/store.ts'
import Papa from 'papaparse'

process.env.ADMIN_SESSION_SECRET = 'test-only-secret-that-is-more-than-32-characters'
process.env.VERCEL_ENV = 'preview'
process.env.VERCEL_GIT_COMMIT_REF = 'test-branch'
const valid = {
  request_id: '6c5b2c57-4d40-4b78-86f7-baf6d3f8c123',
  user_id: 'Ada.Lee', name: 'Ada Lee', email: 'ada@example.com', social_id: '',
  amount: '500', transaction_id: 'TEST-REFERENCE',
  notes: 'Thank you!', consent: true, website: '',
}
const now = Date.parse('2026-09-18T06:00:00Z')
test('validates and normalizes a complete sponsorship request', () => {
  const result = validateSubmission(valid, now)
  assert.equal(result.user_id, 'ada.lee')
  assert.equal(result.photo, undefined)
  assert.equal(result.email, valid.email)
  assert.equal(result.paid_at, new Date(now).toISOString())
  assert.equal(validateSubmission({ ...valid, paid_at: '2000-01-01' }, now).paid_at, result.paid_at)
})
test('rejects missing consent, invalid amounts/email/handles, and spam honeypot', () => {
  for (const patch of [
    { consent: false }, { amount: '0' }, { amount: '-1' }, { amount: '1e3' }, { amount: '1000001' },
    { email: 'bad@example.com\nBcc: victim@example.com' }, { user_id: '../admin' },
    { name: '' }, { transaction_id: '' }, { notes: 'x'.repeat(501) },
    { request_id: '../file' }, { website: 'spam.example' },
  ]) assert.throws(() => validateSubmission({ ...valid, ...patch }, now))
})
test('rejects oversized and non-image uploads', () => {
  for (const photo of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,aGVsbG8=', 'x'.repeat(1400001)]) {
    assert.throws(() => validateSubmission({ ...valid, photo }, now))
  }
})
test('sign-in tokens are tamper-proof, expire, and cannot be used across scopes or as sessions', () => {
  const token = signToken('login', 600)
  assert.ok(verifyToken(token, 'login'))
  assert.equal(verifyToken(token, 'session'), null)
  assert.equal(verifyToken(token + 'x', 'login'), null)
  assert.equal(verifyToken(signToken('login', -1), 'login'), null)
  process.env.VERCEL_GIT_COMMIT_REF = 'other-branch'
  assert.equal(verifyToken(token, 'login'), null)
  process.env.VERCEL_GIT_COMMIT_REF = 'test-branch'
  assert.equal(adminSession(''), false)
  assert.equal(adminSession('sponsor_admin=' + token), false)
  assert.equal(adminSession('sponsor_admin=' + signToken('session', 600)), true)
})
test('mutations require same-origin requests', () => {
  assert.doesNotThrow(() => checkOrigin('https://sponsors.example.com', 'sponsors.example.com'))
  assert.throws(() => checkOrigin(undefined, 'sponsors.example.com'))
  assert.throws(() => checkOrigin('https://evil.example', 'sponsors.example.com'))
  assert.throws(() => checkOrigin('http://sponsors.example.com', 'sponsors.example.com'))
})
test('public projection excludes private fields and export neutralizes spreadsheet formulas', () => {
  const record = { ...valid, paid_at: '2026-09-17T12:00:00.000Z', photo_path: 'private/photo.jpg', photo_type: 'image/jpeg', status: 'approved',
    submitted_at: new Date(now).toISOString(), reviewed_at: new Date(now).toISOString(), pending_email: 'sent', decision_email: 'sent' }
  const publicData = publicRecord(record)
  assert.equal(publicData.paid_at, record.submitted_at)
  assert.equal(publicData.email, undefined)
  assert.equal(publicData.transaction_id, '')
  assert.equal(publicData.photo_path, undefined)
  assert.equal(publicData.request_id, undefined)
  assert.match(publicData.profile_picture, /^\/api\/sponsorship\?action=photo&id=/)
  const csv = csvFor([{ ...record, name: '=HYPERLINK("https://bad.example")' }], true)
  const [row] = Papa.parse(csv, { header: true }).data
  assert.ok(row.name.startsWith("'="))
})
