import type { ReviewRecord } from './store.ts'
import { deliveryInProgress } from './notifications.ts'
import { HttpError } from './validation.ts'

export function reviewRequest(record: ReviewRecord, decision: 'approved' | 'rejected' | 'revoked') {
  if (record.status === decision) return
  if (decision === 'revoked' ? record.status !== 'approved' : record.status !== 'pending') {
    throw new HttpError(409, decision === 'revoked' ? 'Only approved contributions can be revoked.' : 'This request has already been reviewed.')
  }
  const emailState = record.status === 'pending' ? record.pending_email : record.decision_email
  if (deliveryInProgress(emailState)) throw new HttpError(409, 'A status email is being sent. Please try again in a moment.')
  record.status = decision
  record.reviewed_at = new Date().toISOString()
  record.decision_email = ''
}
