import type { IncomingMessage, ServerResponse } from 'node:http'
import { readSpending, replaceSpending, requireSpendingKey } from '../server/spending.ts'
import { HttpError } from '../server/validation.ts'

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  try {
    if (req.method === 'GET') return res.end(JSON.stringify((await readSpending()).data))
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); throw new HttpError(405, 'Use GET or POST.') }
    requireSpendingKey(req.headers.authorization)
    if (!req.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Send JSON data.')
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new HttpError(400, 'Invalid spending data.')
    if (JSON.stringify(req.body).length > 1500000) throw new HttpError(413, 'Spending data is too large.')
    const saved = await replaceSpending(req.body as Record<string, unknown>)
    res.end(JSON.stringify({ ok: true, count: saved.expenses.length, revision: saved.revision, updated_at: saved.updated_at }))
  } catch (error) {
    res.statusCode = error instanceof HttpError ? error.status : 503
    res.end(JSON.stringify({ error: error instanceof HttpError ? error.message : 'Could not load or save spending. Try again shortly.' }))
  }
}
