import Papa from 'papaparse'

export interface Sponsor {
  user_id: string
  paid_at: string
  profile_picture: string
  name: string
  social_id: string
  amount: number
  transaction_id: string
  notes: string
}
const fields = ['user_id', 'paid_at', 'profile_picture', 'name', 'social_id', 'amount', 'transaction_id', 'notes']

export function parseSponsors(csv: string): Sponsor[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  })
  if (result.errors.length || fields.some((field) => !result.meta.fields?.includes(field))) {
    throw new Error('The sponsor CSV must contain all eight columns and valid CSV rows.')
  }
  const userIds = new Set<string>()
  return result.data.map((row, index) => {
    const userId = row.user_id.trim().toLowerCase()
    const paidAt = row.paid_at.trim()
    if (!/^[a-z0-9._]{1,30}$/.test(userId) || userIds.has(userId)) {
      throw new Error(`CSV row ${index + 2} needs a unique username (letters, numbers, dots, or underscores; up to 30 characters).`)
    }
    userIds.add(userId)
    const timestamp = Date.parse(paidAt)
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(paidAt) || !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString() !== paidAt.replace('Z', '.000Z')) {
      throw new Error(`CSV row ${index + 2} needs a valid UTC paid_at timestamp, such as 2026-09-18T10:30:00Z.`)
    }
    const amount = row.amount.trim()
    const value = Number(amount)
    if (!row.name.trim() || !/^\d+(\.\d{1,2})?$/.test(amount) ||
      !Number.isSafeInteger(Math.round(value * 100))) {
      throw new Error(`Check the name and amount on CSV row ${index + 2}.`)
    }
    return {
      user_id: userId,
      paid_at: paidAt,
      profile_picture: row.profile_picture.trim(),
      name: row.name.trim(),
      social_id: row.social_id.trim(),
      amount: value,
      transaction_id: row.transaction_id.trim(),
      notes: row.notes.trim(),
    }
  })
}
export function relativePaymentTime(paidAt: string, now = Date.now()): string {
  const seconds = Math.round((Date.parse(paidAt) - now) / 1000)
  if (seconds <= 0 && seconds > -60) return 'just now'
  const relative = new Intl.RelativeTimeFormat('en', { numeric: 'always' })
  for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]] as const) {
    if (Math.abs(seconds) >= size) return relative.format(Math.trunc(seconds / size), unit)
  }
  return relative.format(seconds, 'second')
}
export function totalAmount(sponsors: Sponsor[]): number {
  const cents = sponsors.reduce((total, sponsor) => total + Math.round(sponsor.amount * 100), 0)
  if (!Number.isSafeInteger(cents)) throw new Error('The sponsorship total is too large.')
  return cents / 100
}
export function profileUrl(value: string): string | undefined {
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const url = new URL(value)
    if (url.protocol === 'https:') return url.href
  } catch { /* Missing or invalid photos use initials. */ }
}
