import { get, put, BlobPreconditionFailedError } from '@vercel/blob'
import Papa from 'papaparse'
import { namespace, hash } from './security.ts'
import { HttpError } from './validation.ts'
import { avatarIconUrl } from '../src/avatar-options.ts'

export interface ReviewRecord {
  request_id: string
  user_id: string
  name: string
  email: string
  social_id: string
  amount: string
  paid_at: string
  transaction_id: string
  notes: string
  photo_path: string
  photo_type: string
  status: 'pending' | 'approved' | 'rejected' | 'revoked'
  submitted_at: string
  reviewed_at: string
  pending_email: string
  decision_email: string
  returning_user_verified?: string
  avatar_icon?: string
}
export const reviewFields = ['request_id','user_id','name','email','social_id','amount','paid_at','transaction_id','notes','photo_path','photo_type','status','submitted_at','reviewed_at','pending_email','decision_email','returning_user_verified','avatar_icon']
export function csvFor(records: ReviewRecord[], exportForExcel = false) {
  return Papa.unparse({ fields: reviewFields, data: records }, { escapeFormulae: exportForExcel })
}
function conflict(error: unknown) {
  return error instanceof BlobPreconditionFailedError || (error instanceof Error && /already exists|precondition/i.test(error.message))
}
export async function readRecords() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new HttpError(503, 'Sponsorship submissions are not configured yet.')
  // Compressed responses can carry weak ETags, which cannot be used for conditional writes.
  const blob = await get(`${namespace()}/admin.csv`, { access: 'private', useCache: false, headers: { 'Accept-Encoding': 'identity' } })
  if (!blob) return { records: [] as ReviewRecord[], etag: undefined }
  if (blob.statusCode !== 200) throw new Error('Unexpected storage response')
  const csv = await new Response(blob.stream).text()
  const parsed = Papa.parse<ReviewRecord>(csv, { header: true, skipEmptyLines: true })
  if (parsed.errors.length || reviewFields.filter(field => !['returning_user_verified', 'avatar_icon'].includes(field)).some(field => !parsed.meta.fields?.includes(field))) throw new Error('Invalid private review CSV')
  return { records: parsed.data, etag: blob.blob.etag }
}
export async function updateRecords<T>(change: (records: ReviewRecord[]) => T): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { records, etag } = await readRecords()
    const result = change(records)
    try {
      await put(`${namespace()}/admin.csv`, csvFor(records), {
        access: 'private', addRandomSuffix: false, contentType: 'text/csv',
        ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
      })
      return result
    } catch (error) {
      if (!conflict(error)) throw error
    }
  }
  throw new HttpError(409, 'Another request was saved at the same time. Please try again.')
}
export async function claimOnce(path: string) {
  try {
    await put(`${namespace()}/${path}`, '1', { access: 'private', addRandomSuffix: false, allowOverwrite: false })
    return true
  } catch (error) {
    if (conflict(error)) return false
    throw error
  }
}
export async function limit(key: string, seconds: number) {
  if (!await claimOnce(`limits/${hash(key)}/${Math.floor(Date.now() / (seconds * 1000))}`)) {
    throw new HttpError(429, 'Please wait a few minutes before trying again.')
  }
}
export function publicRecord(record: ReviewRecord) {
  return {
    user_id: record.user_id, name: record.name, social_id: record.social_id,
    amount: Number(record.amount), paid_at: record.submitted_at, notes: record.notes,
    profile_picture: record.photo_path ? `/api/sponsorship?action=photo&id=${record.request_id}` : avatarIconUrl(record.avatar_icon),
    transaction_id: '',
  }
}
export function publicSponsors(records: ReviewRecord[]) {
  const sponsors = new Map<string, ReturnType<typeof publicRecord>>()
  for (const record of records.filter(record => record.status === 'approved')) {
    const key = record.user_id.toLowerCase()
    const sponsor = sponsors.get(key)
    if (!sponsor) sponsors.set(key, publicRecord(record))
    else {
      sponsor.amount = (Math.round(sponsor.amount * 100) + Math.round(Number(record.amount) * 100)) / 100
      if (record.submitted_at > sponsor.paid_at) sponsor.paid_at = record.submitted_at
    }
  }
  return [...sponsors.values()]
}
