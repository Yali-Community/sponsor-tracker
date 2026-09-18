import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizedEmail, requireEmailVerification } from '../server/email-verification.ts'
import { createSponsorChallenge, confirmSponsorCode } from '../server/sponsor-auth.ts'
import { socialLink } from '../server/social.ts'

process.env.ADMIN_SESSION_SECRET = 'test-only-secret-that-is-more-than-32-characters'
test('new and returning sponsorships require proof bound to the verified address and request', () => {
  const proof = confirmSponsorCode(createSponsorChallenge('email', 'request', '123456', 'ada@example.com'), '123456')
  assert.doesNotThrow(() => requireEmailVerification(proof, 'request', 'ada@example.com'))
  for (const [token, id, email] of [[undefined, 'request', 'ada@example.com'], [proof, 'other-request', 'ada@example.com'], [proof, 'request', 'bob@example.com']]) {
    assert.throws(() => requireEmailVerification(token, id, email), error => error.code === 'EMAIL_VERIFICATION_REQUIRED')
  }
  const oldProof = confirmSponsorCode(createSponsorChallenge('ada', 'request', '123456', 'ada@example.com'), '123456')
  assert.throws(() => requireEmailVerification(oldProof, 'request', 'ada@example.com'))
  assert.equal(normalizedEmail(' ADA@example.com '), 'ada@example.com')
  assert.throws(() => normalizedEmail('ada@example.com\nBcc: bad@example.com'))
})
test('social choices normalize handles and profile URLs while custom links require HTTPS', () => {
  assert.equal(socialLink('instagram', '@ada.lee'), 'https://instagram.com/ada.lee')
  assert.equal(socialLink('instagram', 'https://www.instagram.com/ada.lee/?igsh=abc'), 'https://instagram.com/ada.lee')
  assert.equal(socialLink('twitter', 'https://twitter.com/ada_lee'), 'https://x.com/ada_lee')
  assert.equal(socialLink('custom', 'https://example.com/profile'), 'https://example.com/profile')
  assert.equal(socialLink('instagram', ''), '')
  for (const [type, value] of [['custom', 'javascript:alert(1)'], ['custom', 'http://example.com'], ['instagram', 'https://evil.example/ada'], ['twitter', 'has space'], ['custom', 'https://user:password@example.com']]) {
    assert.throws(() => socialLink(type, value))
  }
})
