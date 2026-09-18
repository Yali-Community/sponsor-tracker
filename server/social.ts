import { HttpError } from './validation.ts'

export function socialLink(platform: unknown, value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'Check your social profile.')
  const text = value.trim()
  if (!text) return ''
  if (platform === 'instagram' || platform === 'twitter') {
    const host = platform === 'instagram' ? 'instagram.com' : 'x.com'
    const allowedHosts = platform === 'instagram' ? ['instagram.com', 'www.instagram.com'] : ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']
    let handle = text.replace(/^@/, '')
    if (/^https?:\/\//i.test(text)) {
      let url: URL
      try { url = new URL(text) } catch { throw new HttpError(400, 'Enter a valid social profile link.') }
      if (!allowedHosts.includes(url.hostname) || url.username || url.password || url.port) throw new HttpError(400, 'Use a profile link from the selected platform.')
      handle = url.pathname.replace(/^\//, '').replace(/\/$/, '')
    }
    const pattern = platform === 'instagram' ? /^[a-zA-Z0-9._]{1,30}$/ : /^[a-zA-Z0-9_]{1,15}$/
    if (!pattern.test(handle)) throw new HttpError(400, 'Enter a valid handle or profile link for the selected platform.')
    return `https://${host}/${handle}`
  }
  if (platform !== 'custom') throw new HttpError(400, 'Choose Instagram, X / Twitter, or a custom link.')
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.username || url.password || text.length > 100) throw new Error()
    return text
  } catch { throw new HttpError(400, 'Enter an HTTPS link of up to 100 characters.') }
}
