import { HttpError } from './validation.ts'
import { namespace } from './security.ts'

export class StorageConflictError extends Error {}
function configuration() {
  const repository = process.env.GITHUB_STORAGE_REPO
  const token = process.env.GITHUB_STORAGE_TOKEN
  const branch = process.env.GITHUB_STORAGE_BRANCH || 'main'
  if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository) || !token) throw new HttpError(503, 'GitHub storage is not configured.')
  return { repository, token, branch }
}
async function request(path: string, init: RequestInit = {}) {
  const { repository, token } = configuration()
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    ...init, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', ...init.headers },
  })
  return response
}
// Fail closed: never put private sponsor records in a public repository.
async function requirePrivateRepository() {
  const response = await request('')
  if (!response.ok || !(await response.json()).private) throw new HttpError(503, 'Private GitHub storage is unavailable.')
}
function location(path: string) {
  if (!path.startsWith(`${namespace()}/`) || path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid storage path')
  return '/contents/' + path.split('/').map(encodeURIComponent).join('/')
}
export async function get(path: string, _options?: unknown) {
  await requirePrivateRepository()
  const { branch } = configuration()
  const response = await request(`${location(path)}?ref=${encodeURIComponent(branch)}`)
  if (response.status === 404) return null
  if (!response.ok) throw new HttpError(503, 'GitHub storage is unavailable. Try again shortly.')
  const file = await response.json()
  if (file.type !== 'file' || !file.sha) throw new Error('Invalid stored file')
  let bytes: Buffer
  if (file.encoding === 'base64') bytes = Buffer.from(file.content, 'base64')
  else {
    // Contents omits base64 above 1 MB. Fetch the immutable blob by SHA.
    const raw = await request(`/git/blobs/${file.sha}`, { headers: { Accept: 'application/vnd.github.raw+json' } })
    if (!raw.ok) throw new HttpError(503, 'Stored file is unavailable.')
    bytes = Buffer.from(await raw.arrayBuffer())
  }
  return { statusCode: 200, stream: new Response(new Uint8Array(bytes)).body!, blob: { etag: file.sha } }
}
export async function put(path: string, content: string | Uint8Array, options: { ifMatch?: string; allowOverwrite?: boolean; access?: string; addRandomSuffix?: boolean; contentType?: string } = {}) {
  await requirePrivateRepository()
  const { branch } = configuration()
  // A missing SHA is create-only; existing files can only change with their exact SHA.
  const response = await request(location(path), { method: 'PUT', body: JSON.stringify({
    message: 'up', branch, content: Buffer.from(content).toString('base64'), ...(options.ifMatch ? { sha: options.ifMatch } : {}),
  }) })
  if (response.status === 409 || response.status === 422) throw new StorageConflictError('Storage precondition failed')
  if (!response.ok) throw new HttpError(503, 'Could not save to GitHub. Try again shortly.')
  return { pathname: path }
}
export async function del(path: string) {
  const existing = await get(path)
  if (!existing) return
  const { branch } = configuration()
  const response = await request(location(path), { method: 'DELETE', body: JSON.stringify({ message: 'up', branch, sha: existing.blob.etag }) })
  if (response.status === 409 || response.status === 422) throw new StorageConflictError('Storage precondition failed')
  if (!response.ok) throw new HttpError(503, 'Could not remove stored photo.')
}
