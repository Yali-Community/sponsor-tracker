import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adminUsers, editUser, editContribution, contributionVersion } from '../server/users.ts'
import { publicSponsors } from '../server/store.ts'
import { createSponsorChallenge, confirmSponsorCode, requireSponsorVerification } from '../server/sponsor-auth.ts'
import { notify } from '../server/notifications.ts'

process.env.ADMIN_SESSION_SECRET = 'test-only-secret-that-is-more-than-32-characters'
function rows() {
  const first = { request_id: '12345678-1234-4234-8234-123456789abc', user_id: 'ada', name: 'Ada', email: 'ada@example.com', social_id: '@ada', amount: '500', transaction_id: 'TX-1', notes: 'Hello', photo_path: 'old.png', photo_type: 'image/png', status: 'approved', submitted_at: '2026-09-18T10:00:00Z', paid_at: '2026-09-18T10:00:00Z', reviewed_at: '2026-09-18T11:00:00Z', pending_email: 'sent', decision_email: 'sent' }
  return [first, { ...first, request_id: '12345678-1234-4234-8234-123456789abd', transaction_id: 'TX-2', amount: '200', status: 'pending' }, { ...first, user_id: 'bob', request_id: '12345678-1234-4234-8234-123456789abe', transaction_id: 'TX-3' }]
}
test('users include every status once, and profile edits preserve payments while updating all matching rows', () => {
  const records = rows()
  const users = adminUsers(records)
  assert.equal(users.length, 2)
  assert.equal(users[0].approved_amount, 500)
  assert.equal(users[0].contributions, 2)
  const before = structuredClone(records)
  editUser(records, { ...users[0], user_id: 'Ada.New', name: 'Ada New', email: 'new@example.com', social_id: '', remove_photo: true })
  for (const [i, row] of records.entries()) {
    if (i === 2) { assert.deepEqual(row, before[i]); continue }
    assert.equal(row.user_id, 'ada.new'); assert.equal(row.email, 'new@example.com'); assert.equal(row.photo_path, '')
    for (const key of ['amount', 'transaction_id', 'notes', 'status', 'submitted_at', 'reviewed_at']) assert.equal(row[key], before[i][key])
  }
  assert.equal(publicSponsors(records)[0].name, 'Ada New')
  assert.throws(() => editUser(records, users[0]), /profile changed/)
})
test('profile edits reject taken usernames, invalid fields and active email delivery without changes', () => {
  for (const patch of [{ user_id: 'BOB' }, { email: 'invalid' }, { name: '' }, { photo: 'data:image/svg+xml;base64,bad' }]) {
    const records = rows(), before = structuredClone(records)
    assert.throws(() => editUser(records, { ...adminUsers(records)[0], ...patch }))
    assert.deepEqual(records, before)
  }
  const records = rows()
  records[1].pending_email = `sending:${Date.now()}:id`
  assert.throws(() => editUser(records, { ...adminUsers(records)[0], name: 'Edited' }), /email is being sent/)
})
test('contribution edits update public totals without changing profile, status, or timestamps', () => {
  const records = rows(), before = structuredClone(records)
  const input = { request_id: records[0].request_id, version: contributionVersion(records[0]), amount: '1001.50', transaction_id: 'corrected', notes: 'Updated note' }
  editContribution(records, input)
  assert.equal(publicSponsors(records)[0].amount, 1001.5)
  assert.equal(records[0].notes, 'Updated note')
  for (const key of ['email', 'name', 'status', 'submitted_at', 'reviewed_at']) assert.equal(records[0][key], before[0][key])
  assert.deepEqual(records.slice(1), before.slice(1))
  assert.throws(() => editContribution(records, input), /contribution changed/)
  assert.throws(() => editContribution(records, { ...input, version: contributionVersion(records[0]), transaction_id: 'tx-2' }), /another contribution/)
  assert.throws(() => editContribution(records, { ...input, version: contributionVersion(records[0]), amount: '-1' }))
})
test('changing the saved email invalidates codes and verified proofs for the previous email', () => {
  const challenge = createSponsorChallenge('ada', 'request', '123456', 'old@example.com')
  const proof = confirmSponsorCode(challenge, '123456')
  assert.doesNotThrow(() => requireSponsorVerification(proof, 'ada', 'request', 'old@example.com'))
  assert.throws(() => requireSponsorVerification(proof, 'ada', 'request', 'new@example.com'))
  const delayedProof = confirmSponsorCode(challenge, '123456')
  assert.throws(() => requireSponsorVerification(delayedProof, 'ada', 'request', 'new@example.com'))
})
test('a queued notification uses the profile present when delivery is claimed', async () => {
  const records = rows(), old = { ...records[0] }
  records[0].decision_email = ''; records[0].email = 'updated@example.com'
  let recipient
  await notify(old, 'decision_email', { updateRecords: async change => change(records), sendStatus: async record => { recipient = record.email } })
  assert.equal(recipient, 'updated@example.com')
})
