import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSponsorChallenge, confirmSponsorCode, requireSponsorVerification } from '../server/sponsor-auth.ts'
import { signToken } from '../server/security.ts'
import { publicSponsors } from '../server/store.ts'

process.env.ADMIN_SESSION_SECRET = 'test-only-secret-that-is-more-than-32-characters'
test('email codes bind verification to one user and transaction request', () => {
  const challenge = createSponsorChallenge('ada', 'request-one', '123456')
  assert.throws(() => confirmSponsorCode(challenge, '999999'))
  assert.throws(() => confirmSponsorCode(challenge + 'x', '123456'))
  const verified = confirmSponsorCode(challenge, '123456')
  assert.doesNotThrow(() => requireSponsorVerification(verified, 'ada', 'request-one'))
  assert.throws(() => requireSponsorVerification(verified, 'bob', 'request-one'))
  assert.throws(() => requireSponsorVerification(verified, 'ada', 'request-two'))
  assert.throws(() => requireSponsorVerification(challenge, 'ada', 'request-one'))
  assert.throws(() => requireSponsorVerification(signToken('sponsor-verified', -1, { user_id: 'ada', request_id: 'request-one' }), 'ada', 'request-one'))
  assert.throws(() => requireSponsorVerification(undefined, 'ada', 'request-one'))
})
test('approved repeat contributions share one public identity and exact total', () => {
  const original = { user_id: 'ada', request_id: 'one', name: 'Ada', email: 'private@example.com', amount: '0.10', status: 'approved', submitted_at: '2026-09-18T10:00:00Z', photo_path: 'original.png', notes: 'Hello' }
  const second = { ...original, request_id: 'two', name: 'Overwritten name', amount: '0.20', submitted_at: '2026-09-19T10:00:00Z' }
  const [sponsor] = publicSponsors([original, second, { ...second, status: 'pending', amount: '999' }])
  assert.equal(publicSponsors([original, second]).length, 1)
  assert.equal(sponsor.amount, 0.3)
  assert.equal(sponsor.name, 'Ada')
  assert.equal(sponsor.paid_at, second.submitted_at)
  assert.equal(sponsor.email, undefined)
  assert.equal(sponsor.profile_picture, '/api/sponsorship?action=photo&id=one')
})
