import { test } from 'node:test'
import assert from 'node:assert/strict'
import { get, put, del, StorageConflictError } from '../server/storage.ts'
import { namespace } from '../server/security.ts'

test('private GitHub storage preserves binary data, SHA writes, create-only claims and failures', async () => {
  const original = global.fetch
  process.env.GITHUB_STORAGE_REPO = 'owner/private-data'
  process.env.GITHUB_STORAGE_TOKEN = 'test-only'
  const path = `${namespace()}/admin.csv`
  const calls = []
  let privateRepo = true, code = 200
  global.fetch = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('/private-data')) return Response.json({ private: privateRepo })
    if (options.method) return Response.json({}, { status: code })
    return Response.json({ type: 'file', sha: 'abc', encoding: 'base64', content: Buffer.from('தமிழ்,₹100').toString('base64') })
  }
  try {
    const file = await get(path)
    assert.equal(await new Response(file.stream).text(), 'தமிழ்,₹100')
    assert.equal(file.blob.etag, 'abc')
    await put(path, 'updated', { ifMatch: 'abc' })
    let payload = JSON.parse(calls.at(-1).options.body)
    assert.equal(payload.sha, 'abc')
    assert.equal(Buffer.from(payload.content, 'base64').toString(), 'updated')
    await put(path, '1', { allowOverwrite: false })
    assert.equal(JSON.parse(calls.at(-1).options.body).sha, undefined)
    code = 409
    await assert.rejects(put(path, 'conflict'), StorageConflictError)
    code = 403
    await assert.rejects(put(path, 'limited'), /Could not save/)
    code = 200
    await del(path)
    assert.equal(JSON.parse(calls.at(-1).options.body).sha, 'abc')
    privateRepo = false
    const count = calls.length
    await assert.rejects(put(path, 'private data'), /Private GitHub/)
    assert.equal(calls.length, count + 1)
    privateRepo = true
    await assert.rejects(get('production/../secret'), /Invalid storage path/)
  } finally { global.fetch = original }
})
