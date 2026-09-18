import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkSubmissionLimit } from '../server/submission-limit.ts'

const now = Date.parse('2026-09-18T12:00:00Z')
const saved = (secondsAgo, email = 'sponsor@example.com') => ({ email, submitted_at: new Date(now - secondsAgo * 1000).toISOString() })
test('failed attempts do not consume allowance and consecutive saved payments are allowed', () => {
  const records = [saved(1)]
  for (let attempt = 0; attempt < 20; attempt++) checkSubmissionLimit(records, 'sponsor@example.com', now)
  assert.equal(records.length, 1)
  for (let count = 1; count < 10; count++) {
    checkSubmissionLimit(records, 'sponsor@example.com', now)
    records.push(saved(0))
  }
  assert.throws(() => checkSubmissionLimit(records, 'SPONSOR@example.com', now), error =>
    error.status === 429 && error.code === 'SUBMISSION_RATE_LIMIT' && error.retryAfter === 299)
})
test('other sponsors and expired submissions do not block a submission', () => {
  const records = [...Array.from({ length: 20 }, () => saved(0, 'other@example.com')), ...Array.from({ length: 10 }, () => saved(300))]
  assert.doesNotThrow(() => checkSubmissionLimit(records, 'sponsor@example.com', now))
})
