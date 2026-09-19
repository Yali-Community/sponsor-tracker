import type { ReviewRecord } from './store.ts'
import { HttpError, validateSubmission } from './validation.ts'

export function addAdminContribution(records: ReviewRecord[], input: Record<string, unknown>, now = Date.now()) {
  const username = typeof input.user_id === 'string' ? input.user_id.trim().toLowerCase() : ''
  const account = records.find(row => row.user_id.toLowerCase() === username)
  const validated = validateSubmission({
    request_id: input.request_id, user_id: username, amount: input.amount,
    name: account?.name || username, email: account?.email || '', social_id: account?.social_id || '',
    avatar_icon: account?.avatar_icon || (account ? '' : 'heart'),
    transaction_id: `ADMIN-${input.request_id}`, notes: '', consent: true,
  }, now, true)
  const existing = records.find(row => row.request_id === validated.request_id)
  if (existing) {
    if (existing.entry_source !== 'admin' || existing.user_id !== username || Number(existing.amount) !== Number(validated.amount)) {
      throw new HttpError(409, 'This entry was already saved with different details. Refresh before adding another.')
    }
    return { request_id: existing.request_id, status: existing.status }
  }
  const record: ReviewRecord = {
    request_id: validated.request_id, user_id: username, name: validated.name, email: validated.email,
    social_id: validated.social_id, avatar_icon: validated.avatar_icon, amount: validated.amount,
    transaction_id: validated.transaction_id, notes: '', photo_path: account?.photo_path || '', photo_type: account?.photo_type || '',
    paid_at: validated.paid_at, submitted_at: validated.paid_at, reviewed_at: validated.paid_at,
    status: 'approved', pending_email: 'not_required', decision_email: 'not_required', entry_source: 'admin',
  }
  records.push(record)
  return { request_id: record.request_id, status: record.status }
}
