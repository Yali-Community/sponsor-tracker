import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parseSponsors, profileUrl, relativePaymentTime, totalAmount } from '../src/sponsors.ts'

const header = 'user_id,paid_at,profile_picture,name,social_id,amount,transaction_id,notes'
const date = '2026-09-18T05:40:00Z'
const row = (id = 'ada', amount = '100', paidAt = date) => `${id},${paidAt},,Ada,social,${amount},TX-1,`

test('parses BOM, CRLF, quoted commas, escaped quotes, and multiline notes', () => {
  const [sponsor] = parseSponsors('\uFEFF' + header + '\r\n' + row() + '"Hello, ""team""!\nThanks."\r\n')
  assert.equal(sponsor.notes, 'Hello, "team"!\nThanks.')
  assert.equal(sponsor.user_id, 'ada')
})
test('supports empty data, optional values and zero amounts', () => {
  assert.deepEqual(parseSponsors(header + '\n'), [])
  assert.equal(parseSponsors(header + '\n' + row('ada', '0'))[0].notes, '')
})
test('rejects incomplete schema and malformed rows', () => {
  for (const csv of ['name,amount\nAda,5', header + '\nAda,5', header + '\n' + row() + 'notes,extra']) {
    assert.throws(() => parseSponsors(csv))
  }
})
test('requires unique case-insensitive Instagram-style handles', () => {
  assert.equal(parseSponsors(header + '\n' + row('Ada.Lee_1'))[0].user_id, 'ada.lee_1')
  for (const id of ['', '@ada', 'ada lee', 'x'.repeat(31)]) {
    assert.throws(() => parseSponsors(header + '\n' + row(id)))
  }
  assert.throws(() => parseSponsors(header + '\n' + row('Ada') + '\n' + row('ada')))
})
test('requires actual calendar timestamps with explicit UTC', () => {
  for (const date of ['', 'yesterday', '2026-02-30T05:00:00Z', '2026-09-18', '2026-09-18T05:40:00', '2026-09-18T25:00:00Z']) {
    assert.throws(() => parseSponsors(header + '\n' + row('ada', '100', date)))
  }
})
test('validates names and amounts; sums minor units exactly', () => {
  for (const amount of ['', '-1', 'Infinity', 'NaN', '1e3', '0.001', '9007199254740991']) {
    assert.throws(() => parseSponsors(header + '\n' + row('ada', amount)))
  }
  assert.throws(() => parseSponsors(header + '\n' + row().replace(',Ada,', ',,')))
  assert.equal(totalAmount(parseSponsors(header + '\n' + row('ada', '0.1') + '\n' + row('sam', '0.2'))), 0.3)
})
test('formats real elapsed time across boundaries and handles future clock skew honestly', () => {
  const now = Date.parse(date)
  const at = seconds => new Date(now - seconds * 1000).toISOString()
  assert.equal(relativePaymentTime(at(0), now), 'just now')
  assert.equal(relativePaymentTime(at(59), now), 'just now')
  assert.equal(relativePaymentTime(at(60), now), '1 minute ago')
  assert.equal(relativePaymentTime(at(600), now), '10 minutes ago')
  assert.equal(relativePaymentTime(at(3600), now), '1 hour ago')
  assert.equal(relativePaymentTime(at(86400), now), '1 day ago')
  assert.equal(relativePaymentTime(at(-600), now), 'in 10 minutes')
})
test('allows HTTPS and local photos, rejects active URLs', () => {
  assert.equal(profileUrl('https://example.com/a.jpg'), 'https://example.com/a.jpg')
  assert.equal(profileUrl('/a.jpg'), '/a.jpg')
  for (const url of ['', 'javascript:alert(1)', '//example.com/a', 'data:text/html,hi']) assert.equal(profileUrl(url), undefined)
})
test('sample data has 15 uniquely identified sponsors totaling 28300', () => {
  const sponsors = parseSponsors(readFileSync(new URL('../sponsors.example.csv', import.meta.url), 'utf8'))
  assert.equal(sponsors.length, 15)
  assert.equal(new Set(sponsors.map(s => s.user_id)).size, 15)
  assert.equal(totalAmount(sponsors), 28300)
})
