export class HttpError extends Error {
  status: number
  code?: string
  retryAfter?: number
  constructor(status: number, message: string, code?: string, retryAfter?: number) {
    super(message); this.status = status; this.code = code; this.retryAfter = retryAfter
  }
}
export interface Submission {
  request_id: string
  user_id: string
  name: string
  email: string
  social_id: string
  amount: string
  paid_at: string
  transaction_id: string
  notes: string
  photo?: { bytes: Buffer; type: string; extension: string }
}
export function validateSubmission(input: Record<string, unknown>, now = Date.now()): Submission {
  function text(key: string, max: number, required = true) {
    const value = input[key]
    if (typeof value !== 'string' || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new HttpError(400, `Check ${key.replaceAll('_', ' ')}.`)
    if (required && !value.trim()) throw new HttpError(400, `Enter ${key.replaceAll('_', ' ')}.`)
    return value.trim()
  }
  const request_id = text('request_id', 36)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request_id)) throw new HttpError(400, 'Reload the form and try again.')
  const user_id = text('user_id', 30).toLowerCase()
  if (!/^[a-z0-9._]{1,30}$/.test(user_id)) throw new HttpError(400, 'Use letters, numbers, dots or underscores for your user ID.')
  const name = text('name', 80)
  const email = text('email', 254).toLowerCase()
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.')
  const amount = text('amount', 12)
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 1000000) throw new HttpError(400, 'Enter an amount between ₹0.01 and ₹10,00,000.')
  const paid_at = new Date(now).toISOString()
  const transaction_id = text('transaction_id', 100)
  if (/[\r\n]/.test(transaction_id)) throw new HttpError(400, 'Enter a valid payment reference.')
  if (input.consent !== true) throw new HttpError(400, 'Please agree to publish your sponsor details after approval.')
  if (input.website) throw new HttpError(400, 'Unable to submit this request.')
  let photo: Submission['photo']
  if (input.photo) {
    if (typeof input.photo !== 'string' || input.photo.length > 1400000) throw new HttpError(400, 'Choose a PNG or JPEG photo under 1 MB.')
    const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(input.photo)
    if (!match) throw new HttpError(400, 'Choose a PNG or JPEG photo.')
    const bytes = Buffer.from(match[2], 'base64')
    if (!bytes.length || bytes.length > 1024 * 1024) throw new HttpError(400, 'Choose a photo under 1 MB.')
    const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    if (!valid) throw new HttpError(400, 'The photo does not match its image format.')
    photo = { bytes, type: `image/${match[1]}`, extension: match[1] === 'jpeg' ? 'jpg' : 'png' }
  }
  return { request_id, user_id, name, email, amount, paid_at, transaction_id,
    social_id: text('social_id', 100, false), notes: text('notes', 500, false), photo }
}
