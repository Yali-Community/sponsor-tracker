import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-600.css'
import './style.css'
import type { Expense, Spending } from '../server/spending'

const status = document.querySelector('#spending-status')!
const refresh = document.querySelector<HTMLButtonElement>('#refresh-spending')!
const search = document.querySelector<HTMLInputElement>('#spending-search')!
const category = document.querySelector<HTMLSelectElement>('#spending-category')!
const rows = document.querySelector('#spending-rows')!
let expenses: Expense[] = []
const money = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount)
function node(tag: string, text: string, className = '') {
  const element = document.createElement(tag); element.textContent = text; element.className = className; return element
}
function render() {
  const query = search.value.trim().toLowerCase()
  const filtered = expenses.filter(row => (!category.value || (row.category || 'Other') === category.value) && [row.description, row.category, row.notes, row.id].some(value => value.toLowerCase().includes(query)))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
  rows.replaceChildren()
  for (const expense of filtered) {
    const row = document.createElement('tr')
    const date = new Date(`${expense.date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    const detail = node('td', '')
    detail.append(node('strong', expense.description), node('span', expense.category || 'Other', 'expense-category'))
    if (expense.notes) detail.append(node('p', expense.notes, 'expense-note'))
    row.append(node('td', date), detail, node('td', money(expense.amount))); rows.append(row)
  }
  document.querySelector('#spending-count')!.textContent = `${filtered.length} expense${filtered.length === 1 ? '' : 's'} · ${money(filtered.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100)}${query || category.value ? ' shown' : ''}`
  const empty = document.querySelector<HTMLElement>('#spending-empty')!
  empty.hidden = filtered.length > 0
  empty.textContent = expenses.length ? 'No matching expenses. Try another search or category.' : 'No spending published yet.'
  document.querySelector<HTMLElement>('.spending-table-wrap')!.hidden = filtered.length === 0
}
async function load() {
  refresh.disabled = true; status.textContent = 'Loading spending…'
  try {
    const response = await fetch('/api/spending')
    if (!response.ok) throw new Error('Spending is unavailable. Please try Refresh in a moment.')
    const data: Spending = await response.json()
    expenses = data.expenses
    const previous = category.value
    category.replaceChildren(new Option('All categories', ''))
    for (const value of [...new Set(expenses.map(row => row.category || 'Other'))].sort()) category.add(new Option(value, value))
    category.value = [...category.options].some(option => option.value === previous) ? previous : ''
    document.querySelector('#spending-total')!.textContent = money(expenses.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100)
    document.querySelector('#spending-updated')!.textContent = data.updated_at ? `Last published ${new Date(data.updated_at).toLocaleString()}` : 'Waiting for the first sheet update.'
    document.querySelector<HTMLElement>('#spending-content')!.hidden = false
    status.textContent = ''; render()
  } catch (error) { status.textContent = (error as Error).message }
  finally { refresh.disabled = false }
}
search.addEventListener('input', render); category.addEventListener('change', render)
refresh.addEventListener('click', () => void load()); void load()
