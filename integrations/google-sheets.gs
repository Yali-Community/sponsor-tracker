// Paste into Extensions > Apps Script in your private Google Sheet.
// Only share edit access with people allowed to publish spending.
const SPENDING_URL = 'https://sponsor-tracker-omega.vercel.app/api/spending';
const SPENDING_PASSCODE = 'REPLACE_WITH_YOUR_PRIVATE_PASSCODE';
const SPENDING_TAB = 'Spending';
const SPENDING_HEADERS = ['id', 'date', 'description', 'category', 'amount', 'notes'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Yali spending')
    .addItem('Set up spending tab', 'setupSpending')
    .addItem('Publish spending', 'publishSpending')
    .addToUi();
}

function setupSpending() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getSheetByName(SPENDING_TAB) || book.insertSheet(SPENDING_TAB);
  if (sheet.getLastRow() > 0) throw new Error('Spending tab is not empty. Keep your data and check the column headers manually.');
  sheet.getRange(1, 1, 1, SPENDING_HEADERS.length).setValues([SPENDING_HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.getRange('B2:B').setNumberFormat('yyyy-mm-dd');
  sheet.getRange('E2:E').setNumberFormat('0.00');
  sheet.setColumnWidth(3, 280);
  sheet.setColumnWidth(6, 280);
  book.toast('Add rows, then use Yali spending → Publish spending. All columns will be public.');
}

function publishSpending() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Publish spending?', 'This replaces the website’s entire spending list with this sheet. Removed rows will disappear. All six columns are public.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) throw new Error('Another publish is running. Please try again shortly.');
  try {
    if (SPENDING_PASSCODE === 'REPLACE_WITH_YOUR_PRIVATE_PASSCODE') throw new Error('Set your private passcode in the script first.');
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = book.getSheetByName(SPENDING_TAB);
    if (!sheet) throw new Error('Use Set up spending tab first.');
    const values = sheet.getDataRange().getValues();
    if (values[0].slice(0, 6).map(String).join(',') !== SPENDING_HEADERS.join(',')) throw new Error('Use these exact headers: ' + SPENDING_HEADERS.join(', '));
    const ids = new Set();
    const expenses = [];
    values.slice(1).forEach(function (row, index) {
      if (row.slice(0, 6).every(function (value) { return value === ''; })) return;
      const id = String(row[0]).trim();
      if (!/^[a-zA-Z0-9._-]{1,80}$/.test(id) || ids.has(id.toLowerCase())) throw new Error('Use a unique ID on row ' + (index + 2));
      ids.add(id.toLowerCase());
      const date = row[1] instanceof Date ? Utilities.formatDate(row[1], book.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : String(row[1]).trim();
      expenses.push({ id: id, date: date, description: String(row[2]).trim(), category: String(row[3]).trim(), amount: String(row[4]).trim(), notes: String(row[5] || '').trim() });
    });
    if (!expenses.length) throw new Error('The sheet is empty. Nothing was published. Use clearPublishedSpending() only if you intend to clear the website.');
    const result = sendSpending(expenses, false);
    book.toast('Published ' + result.count + ' expenses. Refresh the spending page to view them.', 'Yali spending', 8);
  } finally { lock.releaseLock(); }
}

// Run manually from the script editor only when you intend to remove ALL public expenses.
function clearPublishedSpending() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Clear all website spending?', 'This removes every published expense. Your sheet is not changed.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) throw new Error('Another publish is running. Try again shortly.');
  try { sendSpending([], true); SpreadsheetApp.getActiveSpreadsheet().toast('Published spending cleared.'); }
  finally { lock.releaseLock(); }
}

function sendSpending(expenses, confirmEmpty) {
  function request(options) {
    const response = UrlFetchApp.fetch(SPENDING_URL, Object.assign({ muteHttpExceptions: true, followRedirects: false }, options));
    let data;
    try { data = JSON.parse(response.getContentText()); } catch (_) { throw new Error('The website did not return JSON. Check the URL and deployment.'); }
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error(data.error || 'Publish failed. Check the website and try again.');
    return data;
  }
  const current = request({ method: 'get' });
  return request({ method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + SPENDING_PASSCODE }, payload: JSON.stringify({ revision: current.revision, expenses: expenses, confirm_empty: confirmEmpty }) });
}
