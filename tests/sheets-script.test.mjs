import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('Sheets publish sends the exact snapshot with authentication and revision; blank sheets cannot wipe data', () => {
  let values = [['id', 'date', 'description', 'category', 'amount', 'notes'], ['expense-1', '2026-09-21', 'Venue', 'Events', 100.25, ''], ['', '', '', '', '', '']]
  const calls = []; let released = 0
  const book = { getSheetByName: () => ({ getDataRange: () => ({ getValues: () => values }) }), toast() {}, getSpreadsheetTimeZone: () => 'Asia/Kolkata' }
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet: () => book, getUi: () => ({ alert: () => 'yes', ButtonSet: { YES_NO: 'buttons' }, Button: { YES: 'yes' } }) },
    LockService: { getDocumentLock: () => ({ tryLock: () => true, releaseLock: () => released++ }) },
    UrlFetchApp: { fetch: (url, options) => { calls.push({ url, options }); return { getResponseCode: () => 200, getContentText: () => JSON.stringify(options.method === 'get' ? { revision: 7 } : { count: 1 }) } } },
  }
  const source = readFileSync(new URL('../integrations/google-sheets.gs', import.meta.url), 'utf8').replace("const SPENDING_PASSCODE = 'REPLACE_WITH_YOUR_PRIVATE_PASSCODE';", "const SPENDING_PASSCODE = 'test-private-code';")
  runInNewContext(source + '\npublishSpending();', context)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].options.headers.Authorization, 'Bearer test-private-code')
  const payload = JSON.parse(calls[1].options.payload)
  assert.equal(payload.revision, 7); assert.equal(payload.expenses.length, 1); assert.equal(payload.expenses[0].amount, '100.25')
  values = [values[0]]
  assert.throws(() => runInNewContext('publishSpending()', context), /empty/)
  assert.equal(calls.length, 2); assert.equal(released, 2)
})
