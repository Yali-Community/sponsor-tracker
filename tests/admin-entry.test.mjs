import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { addAdminContribution } from '../server/admin-entry.ts'
import { adminUsers, editUser, editContribution, contributionVersion } from '../server/users.ts'
import { publicSponsors } from '../server/store.ts'
import { validateSubmission } from '../server/validation.ts'
import { notify } from '../server/notifications.ts'
process.env.ADMIN_SESSION_SECRET = 'test-only-secret-that-is-more-than-32-characters'
test('two-field admin entry creates an approved minimal profile and retries never duplicate it', () => {
  const rows = [], input = { request_id: randomUUID(), user_id: ' New.User ', amount: '100.50' }
  addAdminContribution(rows, input)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name, 'new.user'); assert.equal(rows[0].email, '')
  assert.equal(rows[0].entry_source, 'admin'); assert.equal(rows[0].status, 'approved')
  assert.ok(rows[0].transaction_id.startsWith('ADMIN-'))
  assert.equal(publicSponsors(rows)[0].amount, 100.5)
  addAdminContribution(rows, input); assert.equal(rows.length, 1)
  assert.throws(() => addAdminContribution(rows, { ...input, amount: '200' }), /already saved/)
  assert.throws(() => validateSubmission({ ...rows[0], consent: true }), /email/)
})
test('existing users retain all profile details and totals add exactly', () => {
  const rows = []
  addAdminContribution(rows, { request_id: randomUUID(), user_id: 'ada', amount: '0.10' })
  Object.assign(rows[0], { name: 'Ada Lee', email: 'ada@example.com', social_id: '@ada', photo_path: 'private.png', photo_type: 'image/png', avatar_icon: 'cat' })
  addAdminContribution(rows, { request_id: randomUUID(), user_id: 'ADA', amount: '0.20' })
  for (const key of ['name', 'email', 'social_id', 'photo_path', 'photo_type', 'avatar_icon']) assert.equal(rows[1][key], rows[0][key])
  assert.equal(publicSponsors(rows)[0].amount, 0.3)
})
test('manual profiles stay editable without a fabricated email and can receive a real email later', async () => {
  const rows = []
  addAdminContribution(rows, { request_id: randomUUID(), user_id: 'ada', amount: '100' })
  editUser(rows, { ...adminUsers(rows)[0], name: 'Ada Lee' })
  editContribution(rows, { request_id: rows[0].request_id, version: contributionVersion(rows[0]), amount: '200', transaction_id: rows[0].transaction_id, notes: 'Corrected' })
  assert.equal(rows[0].amount, '200')
  let sent = false
  await notify(rows[0], 'decision_email', { updateRecords: async f => f(rows), sendStatus: async () => { sent = true } })
  assert.equal(sent, false)
  editUser(rows, { ...adminUsers(rows)[0], email: 'ada@example.com' })
  assert.equal(rows[0].email, 'ada@example.com')
})
test('invalid identifiers and amounts are rejected without adding a record', () => {
  for (const patch of [{ amount: '0' }, { amount: '-1' }, { amount: '1.001' }, { amount: '1000001' }, { user_id: 'bad space' }, { request_id: 'bad' }]) {
    const rows = []
    assert.throws(() => addAdminContribution(rows, { request_id: randomUUID(), user_id: 'ada', amount: '1', ...patch }))
    assert.equal(rows.length, 0)
  }
})
