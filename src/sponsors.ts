import Papa from 'papaparse'

export interface Sponsor {
  profile_picture: string
  name: string
  social_id: string
  amount: number
  transaction_id: string
  notes: string
}
const fields = ['profile_picture', 'name', 'social_id', 'amount', 'transaction_id', 'notes']

export function parseSponsors(csv: string): Sponsor[] {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  })
  if (result.errors.length || fields.some((field) => !result.meta.fields?.includes(field))) {
    throw new Error('The sponsor CSV must contain all six columns and valid CSV rows.')
  }
  return result.data.map((row, index) => {
    const amount = row.amount.trim()
    const value = Number(amount)
    if (!row.name.trim() || !/^\d+(\.\d{1,2})?$/.test(amount) ||
      !Number.isSafeInteger(Math.round(value * 100))) {
      throw new Error(`Check the name and amount on CSV row ${index + 2}.`)
    }
    return {
      profile_picture: row.profile_picture.trim(),
      name: row.name.trim(),
      social_id: row.social_id.trim(),
      amount: value,
      transaction_id: row.transaction_id.trim(),
      notes: row.notes.trim(),
    }
  })
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
