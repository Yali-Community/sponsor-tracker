import { test } from 'node:test'
import assert from 'node:assert/strict'
import { restoreEmailContributions } from '../server/email-recovery.ts'
import { editContribution, contributionVersion } from '../server/users.ts'
import { validateSubmission } from '../server/validation.ts'
process.env.ADMIN_SESSION_SECRET = 'test-secret-longer-than-thirty-two-characters'
const candidate = { request_id:'12345678-1234-4234-8234-123456789abc', username:'ada', name:'Ada', email:'ada@example.com', amount_inr:'500.25', latest_email_status:'approved', excluded_test:false, first_notification_at:'2026-09-18T10:00:00Z', latest_notification_at:'2026-09-18T11:00:00Z' }
test('email recovery excludes tests/revocations, skips existing IDs and preserves existing rows', () => {
  const rows=[]
  const result=restoreEmailContributions(rows,[{...candidate,excluded_test:true},{...candidate,latest_email_status:'revoked'},candidate])
  assert.deepEqual(result,{added:1,amount:500.25})
  assert.equal(rows[0].transaction_id,'')
  assert.equal(rows[0].entry_source,'email_recovery')
  rows[0].amount='700'
  const before=structuredClone(rows)
  assert.deepEqual(restoreEmailContributions(rows,[candidate]),{added:0,amount:0})
  assert.deepEqual(rows,before)
  assert.throws(()=>restoreEmailContributions(rows,[{...candidate,request_id:'12345678-1234-4234-8234-123456789abd',email:'other@example.com'}]),/conflicts/)
  assert.deepEqual(rows,before)
})
test('only trusted recovered records allow an unknown reference in admin editing', () => {
  const rows=[];restoreEmailContributions(rows,[candidate])
  assert.throws(()=>validateSubmission({...rows[0],consent:true}),/transaction id/)
  editContribution(rows,{request_id:rows[0].request_id,version:contributionVersion(rows[0]),amount:'600',transaction_id:'',notes:rows[0].notes})
  assert.equal(rows[0].amount,'600')
  assert.equal(rows[0].transaction_id,'')
})
