import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parseSponsors, profileUrl, totalAmount } from '../src/sponsors.ts'

const header = 'profile_picture,name,social_id,amount,transaction_id,notes'

test('parses quoted commas, escaped quotes, line breaks, CRLF, and BOM', () => {
  const [sponsor] = parseSponsors('\uFEFF' + header + '\r\n,Ada,social,100.25,TX-1,"Hello, ""team""!\nThank you."\r\n')
  assert.equal(sponsor.notes, 'Hello, "team"!\nThank you.')
  assert.equal(sponsor.amount, 100.25)
})

test('allows optional fields, blank lines, zero amounts, and an empty dataset', () => {
  assert.deepEqual(parseSponsors(header + '\n\n'), [])
  assert.equal(parseSponsors(header + '\n,Ada,,0,,\n')[0].notes, '')
})

test('rejects malformed schemas and incomplete rows', () => {
  for (const csv of ['name,amount\nAda,5', header + '\n,Ada,5', header + '\n,Ada,,5,,,extra']) {
    assert.throws(() => parseSponsors(csv))
  }
})

test('rejects missing names and invalid amounts rather than silently undercounting', () => {
  for (const amount of ['', '-1', 'Infinity', 'NaN', '1e3', '0.001', '9007199254740991']) {
    assert.throws(() => parseSponsors(header + `\n,Ada,,${amount},,`))
  }
  assert.throws(() => parseSponsors(header + '\n,,,100,,'))
})

test('sums decimal amounts in minor units', () => {
  assert.equal(totalAmount(parseSponsors(header + '\n,Ada,,0.1,,\n,Sam,,0.2,,')), 0.3)
  assert.equal(totalAmount([]), 0)
})

test('allows HTTPS and local photos, rejecting active and protocol-relative URLs', () => {
  assert.equal(profileUrl('https://example.com/avatar.jpg'), 'https://example.com/avatar.jpg')
  assert.equal(profileUrl('/avatars/ada.jpg'), '/avatars/ada.jpg')
  for (const url of ['', 'javascript:alert(1)', '//example.com/avatar', 'data:text/html,hello']) {
    assert.equal(profileUrl(url), undefined)
  }
})

test('the checked-in sample has 15 sponsors and a total derived from their amounts', () => {
  const sponsors = parseSponsors(readFileSync(new URL('../sponsors.example.csv', import.meta.url), 'utf8'))
  assert.equal(sponsors.length, 15)
  assert.equal(totalAmount(sponsors), 28300)
})
