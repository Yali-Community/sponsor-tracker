import { createHash, timingSafeEqual } from 'node:crypto'
import { get, put, BlobPreconditionFailedError } from '@vercel/blob'
import { namespace } from './security.ts'
import { HttpError } from './validation.ts'

export interface Expense { id: string; date: string; description: string; category: string; amount: number; notes: string }
export interface Spending { revision: number; updated_at: string; expenses: Expense[] }
export function requireSpendingKey(header: unknown) {
  const expected = process.env.SPENDING_SYNC_SECRET
  if (!expected || expected.length < 32) throw new HttpError(503, 'Spending sync is not configured.')
  const digest = (value: string) => createHash('sha256').update(value).digest()
  if (typeof header !== 'string' || !timingSafeEqual(digest(header), digest(`Bearer ${expected}`))) throw new HttpError(401, 'Invalid sync passcode.')
}
export function validateSpending(input: Record<string, unknown>): Expense[] {
  if (!Array.isArray(input.expenses) || input.expenses.length > 2000) throw new HttpError(400, 'Send at most 2,000 spending rows.')
  if (!input.expenses.length && input.confirm_empty !== true) throw new HttpError(400, 'Confirm before clearing every spending row.')
  const ids = new Set<string>()
  return input.expenses.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, `Check row ${index + 2}.`)
    const row = raw as Record<string, unknown>
    function text(key: string, max: number, optional = false) {
      const value = row[key] ?? ''
      if (typeof value !== 'string' || value.trim().length > max || (!optional && !value.trim()) || /[\u0000-\u001f]/.test(value)) throw new HttpError(400, `Check ${key} on row ${index + 2}.`)
      return value.trim()
    }
    const id = text('id', 80), date = text('date', 10)
    if (!/^[a-zA-Z0-9._-]+$/.test(id) || ids.has(id.toLowerCase())) throw new HttpError(400, `Use a unique ID on row ${index + 2}.`)
    ids.add(id.toLowerCase())
    const time = Date.parse(date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) throw new HttpError(400, `Use a real YYYY-MM-DD date on row ${index + 2}.`)
    const amount = String(row.amount ?? '')
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 1000000) throw new HttpError(400, `Enter an amount from 0.01 to 1000000 on row ${index + 2}.`)
    return { id, date, description: text('description', 160), category: text('category', 60, true), amount: Number(amount), notes: text('notes', 500, true) }
  })
}
export async function readSpending() {
  const blob = await get(`${namespace()}/spending.json`, { access: 'private', useCache: false, headers: { 'Accept-Encoding': 'identity' } })
  if (!blob) return { data: { revision: 0, updated_at: '', expenses: [] } as Spending, etag: undefined }
  if (blob.statusCode !== 200) throw new Error('Unexpected storage response')
  const data = await new Response(blob.stream).json() as Spending
  return { data, etag: blob.blob.etag }
}
export async function replaceSpending(input: Record<string, unknown>) {
  const expenses = validateSpending(input)
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 0) throw new HttpError(400, 'Fetch the current revision before publishing.')
  const { data, etag } = await readSpending()
  if (JSON.stringify(data.expenses) === JSON.stringify(expenses)) return data
  if (input.revision !== data.revision) throw new HttpError(409, 'Spending changed during publishing. Review the sheet and publish again.')
  const next = { revision: data.revision + 1, updated_at: new Date().toISOString(), expenses }
  try {
    await put(`${namespace()}/spending.json`, JSON.stringify(next), { access: 'private', addRandomSuffix: false, contentType: 'application/json', ...(etag ? { ifMatch: etag } : { allowOverwrite: false }) })
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError || (error instanceof Error && /already exists|precondition/i.test(error.message))) throw new HttpError(409, 'Another publish finished first. Review the sheet and publish again.')
    throw error
  }
  return next
}
