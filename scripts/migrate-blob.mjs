// Run while old application writes are stopped. Never place recovery files in the public repo.
import { list, get as getBlob } from '@vercel/blob'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { get, put } from '../server/storage.ts'
import { readRecords } from '../server/store.ts'

process.env.VERCEL_ENV = 'production'
const directory = process.argv[2] && resolve(process.argv[2])
if (!directory || !relative(process.cwd(), directory).startsWith('..')) throw new Error('Provide a private recovery directory outside the repository.')
await mkdir(directory, { recursive: true, mode: 0o700 })
const files = []
let cursor
do {
  const page = await list({ prefix: 'production/', cursor, limit: 1000 })
  files.push(...page.blobs)
  cursor = page.hasMore ? page.cursor : undefined
} while (cursor)
if (!files.some(file => file.pathname === 'production/admin.csv')) throw new Error('Source admin CSV is missing. Nothing migrated.')
// Download EVERYTHING before writing anything to GitHub; a paused store must not become an empty database.
for (const file of files) {
  const response = await getBlob(file.url, { access: 'private', useCache: false })
  if (!response || response.statusCode !== 200) throw new Error('Source download failed. Nothing migrated.')
  const destination = resolve(directory, file.pathname)
  if (!destination.startsWith(directory + '/')) throw new Error('Invalid source path')
  await mkdir(resolve(destination, '..'), { recursive: true, mode: 0o700 })
  await writeFile(destination, Buffer.from(await new Response(response.stream).arrayBuffer()), { mode: 0o600 })
}
if (!files.some(file => file.pathname === 'production/spending.json')) {
  const pathname = 'production/spending.json'
  await writeFile(resolve(directory, pathname), JSON.stringify({ revision: 0, updated_at: '', expenses: [] }), { mode: 0o600 })
  files.push({ pathname })
}
// Keep the production guard active until photos, spending and one-time claims are available.
files.sort((a, b) => Number(a.pathname.endsWith('/admin.csv')) - Number(b.pathname.endsWith('/admin.csv')))
for (const file of files) {
  const bytes = await readFile(resolve(directory, file.pathname))
  const current = await get(file.pathname)
  if (current) {
    const saved = Buffer.from(await new Response(current.stream).arrayBuffer())
    if (!saved.equals(bytes)) throw new Error('Destination differs from source. Stop and reconcile before continuing.')
  } else {
    await put(file.pathname, bytes, { allowOverwrite: false })
    const saved = await get(file.pathname)
    if (!saved || !Buffer.from(await new Response(saved.stream).arrayBuffer()).equals(bytes)) throw new Error('Migration verification failed')
    await delay(1100)
  }
}
const { records } = await readRecords()
console.log(`Verified ${files.length} files and ${records.length} sponsor records. Source Blob data was not deleted.`)
