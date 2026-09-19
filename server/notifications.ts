import { randomUUID } from 'node:crypto'
import { updateRecords, type ReviewRecord } from './store.ts'
import { sendStatus } from './email.ts'

export function deliveryInProgress(value: string) {
  return value.startsWith('sending:') && Date.now() - Number(value.split(':')[1]) < 120000
}
export async function notify(record: ReviewRecord, field: 'pending_email' | 'decision_email', dependencies = { updateRecords, sendStatus }) {
  const claim = `sending:${Date.now()}:${randomUUID()}`
  let deliveryRecord = record
  try {
    const state = await dependencies.updateRecords(records => {
      const current = records.find(item => item.request_id === record.request_id)
      if (!current || current.status !== record.status) return 'skip'
      if (!current.email) { current[field] = 'not_required'; return 'skip' }
      if (current[field] === 'sent') return 'sent'
      if (deliveryInProgress(current[field])) return 'skip'
      current[field] = claim
      deliveryRecord = { ...current }
      return 'claimed'
    })
    if (state !== 'claimed') return state === 'sent'
  } catch { return false }
  let delivered = false
  try { await dependencies.sendStatus(deliveryRecord); delivered = true } catch { /* Preserve saved requests when email is unavailable. */ }
  try {
    await dependencies.updateRecords(records => {
      const current = records.find(item => item.request_id === record.request_id)
      if (current?.status === record.status && current[field] === claim) current[field] = delivered ? 'sent' : 'failed'
    })
  } catch { /* The request is saved; an expired delivery claim can be retried by the admin. */ }
  return delivered
}
