import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reviewRequest } from '../server/review.ts'
import { publicSponsors } from '../server/store.ts'

const approved = () => ({ request_id: 'one', user_id: 'ada', name: 'Ada', amount: '500', status: 'approved', submitted_at: new Date().toISOString(), reviewed_at: 'previous', pending_email: 'sent', decision_email: 'sent' })
test('revocation retains the record, removes its amount and resets decision notification once', () => {
  const record = approved(), other = { ...approved(), request_id: 'two', amount: '100' }
  reviewRequest(record, 'revoked')
  assert.equal(record.request_id, 'one')
  assert.equal(record.status, 'revoked')
  assert.equal(record.decision_email, '')
  assert.equal(publicSponsors([record, other])[0].amount, 100)
  assert.deepEqual(publicSponsors([record]), [])
  record.decision_email = 'sent'
  const reviewedAt = record.reviewed_at
  reviewRequest(record, 'revoked')
  assert.equal(record.decision_email, 'sent')
  assert.equal(record.reviewed_at, reviewedAt)
})
test('only approved records can be revoked and sending email is protected', () => {
  for (const status of ['pending', 'rejected']) assert.throws(() => reviewRequest({ ...approved(), status }, 'revoked'))
  assert.throws(() => reviewRequest({ ...approved(), decision_email: `sending:${Date.now()}:claim` }, 'revoked'))
  assert.throws(() => reviewRequest({ ...approved(), status: 'revoked' }, 'approved'))
  const record = { ...approved(), status: 'pending' }
  reviewRequest(record, 'approved')
  assert.equal(record.status, 'approved')
})
