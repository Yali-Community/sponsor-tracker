import assert from 'node:assert/strict'
import { test } from 'node:test'
import { notify, deliveryInProgress } from '../server/notifications.ts'

function fixture() {
  const record = { request_id: 'test', email: 'test@example.com', status: 'pending', pending_email: '', decision_email: '' }
  let sends = 0
  const dependencies = {
    updateRecords: async change => change([record]),
    sendStatus: async () => { sends++ },
  }
  return { record, dependencies, sends: () => sends }
}
test('concurrent notification attempts claim delivery once', async () => {
  const { record, dependencies, sends } = fixture()
  await Promise.all([notify({ ...record }, 'pending_email', dependencies), notify({ ...record }, 'pending_email', dependencies)])
  assert.equal(sends(), 1)
  assert.equal(record.pending_email, 'sent')
})
test('SMTP failures remain retryable without failing saved requests', async () => {
  const { record, dependencies } = fixture()
  dependencies.sendStatus = async () => { throw new Error('SMTP unavailable') }
  assert.equal(await notify(record, 'pending_email', dependencies), false)
  assert.equal(record.pending_email, 'failed')
})
test('bookkeeping failures do not undo successfully delivered email', async () => {
  const { record, dependencies } = fixture()
  let writes = 0
  dependencies.updateRecords = async change => { if (++writes > 1) throw new Error('Store unavailable'); return change([record]) }
  assert.equal(await notify(record, 'pending_email', dependencies), true)
})
test('stale status does not send and abandoned delivery claims can recover', async () => {
  const { record, dependencies, sends } = fixture()
  await notify({ ...record, status: 'approved' }, 'decision_email', dependencies)
  assert.equal(sends(), 0)
  record.pending_email = `sending:${Date.now() - 121000}:abandoned`
  assert.equal(deliveryInProgress(record.pending_email), false)
  await notify(record, 'pending_email', dependencies)
  assert.equal(sends(), 1)
})
