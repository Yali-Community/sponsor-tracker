import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateSpending, requireSpendingKey } from '../server/spending.ts'
import { adminUsers, deleteUser } from '../server/users.ts'
import { addAdminContribution } from '../server/admin-entry.ts'
import { publicSponsors } from '../server/store.ts'
import { randomUUID } from 'node:crypto'
process.env.ADMIN_SESSION_SECRET = 'test-only-secret-that-is-more-than-32-characters'
const expense = { id: 'expense-1', date: '2026-09-21', description: 'Venue', category: 'Events', amount: '100.25', notes: '' }
test('spending accepts only valid public rows and explicit empty replacement', () => {
  assert.equal(validateSpending({ expenses: [expense] })[0].amount, 100.25)
  for (const patch of [{ date: '2026-02-30' }, { amount: '-1' }, { amount: '1.001' }, { amount: '1000001' }, { id: '../private' }, { description: '' }, { notes: '\u0000' }]) assert.throws(() => validateSpending({ expenses: [{ ...expense, ...patch }] }))
  assert.throws(() => validateSpending({ expenses: [expense, { ...expense, id: 'EXPENSE-1' }] }))
  assert.throws(() => validateSpending({ expenses: [] }))
  assert.deepEqual(validateSpending({ expenses: [], confirm_empty: true }), [])
  const row = validateSpending({ expenses: [{ ...expense, secret: 'not public' }] })[0]
  assert.equal(row.secret, undefined)
})
test('webhook requires its configured secret and rejects missing or wrong credentials', () => {
  delete process.env.SPENDING_SYNC_SECRET
  assert.throws(() => requireSpendingKey('Bearer test'), error => error.status === 503)
  process.env.SPENDING_SYNC_SECRET = 'test-secret-more-than-thirty-two-characters'
  for (const value of [undefined, [], 'Bearer wrong', process.env.SPENDING_SYNC_SECRET]) assert.throws(() => requireSpendingKey(value), error => error.status === 401)
  assert.doesNotThrow(() => requireSpendingKey(`Bearer ${process.env.SPENDING_SYNC_SECRET}`))
})
function records() {
  const rows = []
  for (const user_id of ['ada', 'ada', 'bob']) addAdminContribution(rows, { request_id: randomUUID(), user_id, amount: '100' })
  return rows
}
test('deletion removes the entire user history and public total, preserving other users', () => {
  const rows = records(), user = adminUsers(rows)[0]
  rows[1].status = 'revoked'
  const current = adminUsers(rows)[0]
  const result = deleteUser(rows, { request_id: user.request_id, delete_version: current.delete_version, confirm_username: 'ada' })
  assert.equal(result.deleted, 2)
  assert.equal(rows.length, 1); assert.equal(rows[0].user_id, 'bob')
  assert.equal(publicSponsors(rows)[0].amount, 100)
})
test('stale or unconfirmed deletion and active email delivery cannot remove a user', () => {
  const rows = records(), user = adminUsers(rows)[0]
  const input = { request_id: user.request_id, delete_version: user.delete_version, confirm_username: 'ada' }
  assert.throws(() => deleteUser(rows, { ...input, confirm_username: 'bob' }))
  rows[1].amount = '200'
  assert.throws(() => deleteUser(rows, input), /changed/)
  rows[1].decision_email = `sending:${Date.now()}:id`
  assert.throws(() => deleteUser(rows, { ...input, delete_version: adminUsers(rows)[0].delete_version }), /email is being sent/)
  assert.equal(rows.length, 3)
})
