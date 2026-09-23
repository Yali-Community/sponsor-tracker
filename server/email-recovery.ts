import type { ReviewRecord } from './store.ts'
import { validateSubmission } from './validation.ts'

export interface RecoveredContribution {
  request_id: string; username: string; name: string; email: string; amount_inr: string
  latest_email_status: string; excluded_test: boolean
  first_notification_at: string; latest_notification_at: string
}
// Called only by the local recovery script, never from a public API.
export function restoreEmailContributions(records: ReviewRecord[], candidates: RecoveredContribution[]) {
  const ids = new Set(records.map(row => row.request_id))
  const additions: ReviewRecord[] = []
  for (const item of candidates) {
    if (item.excluded_test || item.latest_email_status !== 'approved' || ids.has(item.request_id)) continue
    const submitted = new Date(item.first_notification_at).toISOString()
    const reviewed = new Date(item.latest_notification_at).toISOString()
    const validated = validateSubmission({
      request_id: item.request_id, user_id: item.username, name: item.name, email: item.email,
      amount: item.amount_inr, social_id: '', transaction_id: '', notes: '', consent: true,
    }, Date.parse(submitted), false, true)
    const profile = [...records, ...additions].find(row => row.user_id === validated.user_id)
    if (profile?.email && profile.email.toLowerCase() !== validated.email) throw new Error('Recovered username conflicts with an existing email. Review before importing.')
    additions.push({
      request_id: validated.request_id, user_id: validated.user_id, name: profile?.name || validated.name,
      email: profile?.email || validated.email, social_id: profile?.social_id || '',
      amount: validated.amount, transaction_id: '', notes: 'Recovered from sponsorship emails. Date reflects the first email notification.',
      photo_path: profile?.photo_path || '', photo_type: profile?.photo_type || '', avatar_icon: profile?.avatar_icon || '',
      paid_at: submitted, submitted_at: submitted, reviewed_at: reviewed, status: 'approved',
      pending_email: 'not_required', decision_email: 'not_required', entry_source: 'email_recovery',
    })
    ids.add(item.request_id)
  }
  records.push(...additions)
  return { added: additions.length, amount: additions.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) / 100 }
}
