import type { ReviewRecord } from './store.ts'
import { hash } from './security.ts'
import { deliveryInProgress } from './notifications.ts'
import { HttpError, validateSubmission } from './validation.ts'

const profileFields = ['user_id', 'name', 'email', 'social_id', 'photo_path', 'photo_type', 'avatar_icon'] as const
export function userVersion(record: ReviewRecord) {
  return hash(JSON.stringify(profileFields.map(key => record[key])))
}
export function adminUsers(records: ReviewRecord[]) {
  const groups = new Map<string, ReviewRecord[]>()
  for (const record of records) {
    const key = record.user_id.toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(record)
  }
  return [...groups.values()].map(group => {
    const first = group[0]
    return {
      request_id: first.request_id, user_id: first.user_id, name: first.name, email: first.email,
      social_id: first.social_id, photo_path: first.photo_path, version: userVersion(first),
      avatar_icon: first.avatar_icon || '',
      delete_version: hash(JSON.stringify(group)),
      contributions: group.length,
      approved_amount: group.filter(row => row.status === 'approved').reduce((cents, row) => cents + Math.round(Number(row.amount) * 100), 0) / 100,
    }
  })
}
function editable(record: ReviewRecord) {
  if (deliveryInProgress(record.pending_email) || deliveryInProgress(record.decision_email)) {
    throw new HttpError(409, 'An email is being sent for this user. Try again in a moment.')
  }
}
export function editUser(records: ReviewRecord[], input: Record<string, unknown>, photoPath = '') {
  const anchor = records.find(row => row.request_id === input.request_id)
  if (!anchor) throw new HttpError(404, 'User not found.')
  const group = records.filter(row => row.user_id.toLowerCase() === anchor.user_id.toLowerCase())
  if (input.version !== userVersion(group[0])) throw new HttpError(409, 'This profile changed. Close the editor and refresh before editing again.')
  group.forEach(editable)
  const validated = validateSubmission({ ...anchor, user_id: input.user_id, name: input.name, email: input.email,
    social_id: input.social_id, photo: input.photo, avatar_icon: input.avatar_icon ?? anchor.avatar_icon ?? '', consent: true }, Date.now(), !anchor.email, anchor.entry_source === 'email_recovery')
  if (records.some(row => !group.includes(row) && row.user_id.toLowerCase() === validated.user_id)) {
    throw new HttpError(409, 'This username belongs to another user. Choose a different username.')
  }
  for (const row of group) {
    for (const key of ['user_id', 'name', 'email', 'social_id'] as const) row[key] = validated[key]
    row.photo_path = photoPath || (input.remove_photo === true ? '' : anchor.photo_path)
    row.photo_type = photoPath ? validated.photo!.type : input.remove_photo === true ? '' : anchor.photo_type
    row.avatar_icon = validated.avatar_icon
  }
  return validated
}
export function contributionVersion(record: ReviewRecord) { return hash(JSON.stringify(record)) }
export function deleteUser(records: ReviewRecord[], input: Record<string, unknown>) {
  const anchor = records.find(row => row.request_id === input.request_id)
  if (!anchor) throw new HttpError(404, 'User not found. Refresh the list.')
  const group = records.filter(row => row.user_id.toLowerCase() === anchor.user_id.toLowerCase())
  if (input.confirm_username !== anchor.user_id || input.delete_version !== hash(JSON.stringify(group))) throw new HttpError(409, 'The user or contributions changed. Refresh and confirm deletion again.')
  group.forEach(editable)
  const photos = [...new Set(group.map(row => row.photo_path).filter(Boolean))]
  for (let i = records.length - 1; i >= 0; i--) if (group.includes(records[i])) records.splice(i, 1)
  return { deleted: group.length, photos }
}
export function editContribution(records: ReviewRecord[], input: Record<string, unknown>) {
  const record = records.find(row => row.request_id === input.request_id)
  if (!record) throw new HttpError(404, 'Contribution not found.')
  if (input.version !== contributionVersion(record)) throw new HttpError(409, 'This contribution changed. Close the editor and refresh before editing again.')
  editable(record)
  const validated = validateSubmission({ ...record, amount: input.amount, transaction_id: input.transaction_id, notes: input.notes, consent: true }, Date.now(), !record.email, record.entry_source === 'email_recovery')
  if (validated.transaction_id && records.some(row => row.request_id !== record.request_id && row.transaction_id.toLowerCase() === validated.transaction_id.toLowerCase())) {
    throw new HttpError(409, 'This payment reference belongs to another contribution.')
  }
  record.amount = validated.amount
  record.transaction_id = validated.transaction_id
  record.notes = validated.notes
}
