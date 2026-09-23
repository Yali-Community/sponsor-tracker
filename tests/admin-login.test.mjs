import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requestAdminLogin } from '../server/admin-login.ts'
process.env.ADMIN_EMAIL = 'admin@example.com'
process.env.ADMIN_SESSION_SECRET = 'test-secret-longer-than-thirty-two-characters'
test('admin resend cooldown reports a bounded retry time and uses a one-time GitHub claim', async () => {
  let claimed=false, sent=0
  const deps={claimOnce:async()=>{if(claimed)return false;claimed=true;return true},del:async()=>{},sendEmail:async()=>{sent++}}
  const result=await requestAdminLogin('https://example.com',deps,30000)
  assert.equal(result.retryAfter,30)
  await assert.rejects(requestAdminLogin('https://example.com',deps,30000),e=>e.status===429&&e.retryAfter===30)
  assert.equal(sent,1)
})
test('failed mail releases the cooldown so admin can retry; no configuration consumes no claim', async () => {
  let released=0,claimed=0
  const deps={claimOnce:async()=>{claimed++;return true},del:async()=>{released++},sendEmail:async()=>{throw new Error('mail offline')}}
  await assert.rejects(requestAdminLogin('https://example.com',deps),e=>e.status===503)
  assert.equal(released,1)
  delete process.env.ADMIN_EMAIL
  await assert.rejects(requestAdminLogin('https://example.com',deps),/not configured/)
  assert.equal(claimed,1)
  process.env.ADMIN_EMAIL='admin@example.com'
})
