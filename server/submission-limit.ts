import type { ReviewRecord } from './store.ts'
import { HttpError } from './validation.ts'

// Only persisted requests count. Validation failures and retries consume no allowance.
export function checkSubmissionLimit(records: ReviewRecord[], email: string, now = Date.now()) {
  const windowMs = 5 * 60 * 1000
  const recent = records
    .filter(record => record.email.toLowerCase() === email.toLowerCase())
    .map(record => Date.parse(record.submitted_at))
    .filter(time => time > now - windowMs)
    .sort((a, b) => a - b)
  if (recent.length < 10) return
  const retryAfter = Math.max(1, Math.ceil((recent[recent.length - 10] + windowMs - now) / 1000))
  throw new HttpError(429, `You’ve submitted 10 sponsorships in five minutes. Please try again in ${retryAfter} seconds. Your form details are preserved.`, 'SUBMISSION_RATE_LIMIT', retryAfter)
}
