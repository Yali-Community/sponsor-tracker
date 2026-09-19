import assert from 'node:assert/strict'
import { test } from 'node:test'
import { publicRecord, csvFor } from '../server/store.ts'
import { validateSubmission } from '../server/validation.ts'
import { adminUsers, editUser } from '../server/users.ts'
import { avatarIconUrl } from '../src/avatar-options.ts'
process.env.ADMIN_SESSION_SECRET = 'test-only-secret-that-is-more-than-32-characters'
const record = { request_id: '12345678-1234-4234-8234-123456789abc', user_id: 'ada', name: 'Ada', email: 'ada@example.com', social_id: '', amount: '500', transaction_id: 'TX-1', notes: '', photo_path: '', photo_type: '', status: 'approved', submitted_at: '2026-09-18T10:00:00Z', paid_at: '2026-09-18T10:00:00Z', reviewed_at: '', pending_email: 'sent', decision_email: 'sent' }
test('selected icons validate, persist in CSV, and appear publicly without exposing private data', () => {
  const input = validateSubmission({ ...record, avatar_icon: 'cat', consent: true })
  const saved = { ...record, avatar_icon: input.avatar_icon }
  assert.ok(csvFor([saved]).includes('avatar_icon'))
  assert.equal(publicRecord(saved).profile_picture, '/avatars/cat.svg')
  assert.equal(publicRecord(saved).email, undefined)
  assert.equal(publicRecord({ ...saved, photo_path: 'private.png' }).profile_picture, `/api/sponsorship?action=photo&id=${record.request_id}`)
  assert.equal(publicRecord(record).profile_picture, '')
  assert.equal(avatarIconUrl('../../private'), '')
  assert.throws(() => validateSubmission({ ...record, consent: true, avatar_icon: 'javascript:bad' }))
})
test('admin icon changes update repeat profiles without changing payments', () => {
  const rows = [{ ...record, avatar_icon: 'heart' }, { ...record, request_id: '12345678-1234-4234-8234-123456789abd', amount: '1000', avatar_icon: 'heart' }]
  editUser(rows, { ...adminUsers(rows)[0], avatar_icon: 'leaf' })
  assert.ok(rows.every(row => row.avatar_icon === 'leaf'))
  assert.deepEqual(rows.map(row => row.amount), ['500', '1000'])
})
