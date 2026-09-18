import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-600.css'
import './style.css'

interface Review {
  request_id: string; name: string; user_id: string; email: string; social_id: string
  amount: string; submitted_at: string; transaction_id: string; notes: string; photo_path: string
  status: 'pending' | 'approved' | 'rejected'; pending_email: string; decision_email: string
}
const status = document.querySelector<HTMLParagraphElement>('#admin-message')!
const login = document.querySelector<HTMLElement>('#admin-login')!
const content = document.querySelector<HTMLElement>('#admin-content')!
const list = document.querySelector('#review-list')!
const filter = document.querySelector<HTMLSelectElement>('#status-filter')!
let records: Review[] = []
let generation = 0
let signingOut = false

function node(tag: string, text = '', className = '') {
  const element = document.createElement(tag)
  element.textContent = text
  element.className = className
  return element
}
async function api(action: string, data?: object) {
  const response = await fetch(`/api/sponsorship?action=${action}`, data ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  } : undefined)
  const result = await response.json()
  if (!response.ok) {
    if (response.status === 401) { generation++; login.hidden = false; content.hidden = true; records = []; list.replaceChildren() }
    throw new Error(result.error || 'Request failed.')
  }
  return result
}
async function load() {
  if (signingOut) return
  const current = ++generation
  try {
    const incoming = await api('admin')
    if (current !== generation) return
    records = incoming
    login.hidden = true
    content.hidden = false
    render()
  } catch (error) { status.textContent = (error as Error).message }
}
function render() {
  list.replaceChildren()
  const filtered = records.filter(record => record.status === filter.value)
  if (!filtered.length) list.append(node('p', `No ${filter.value} requests.`, 'empty-state'))
  for (const record of filtered) {
    const article = node('article', '', 'review-entry')
    const heading = node('div', '', 'review-heading')
    if (record.photo_path) {
      const image = document.createElement('img')
      image.src = `/api/sponsorship?action=photo&id=${encodeURIComponent(record.request_id)}`
      image.alt = `${record.name}'s submitted profile photo`
      image.width = 56; image.height = 56
      heading.append(image)
    }
    heading.append(node('h2', record.name), node('span', `₹${record.amount}`, 'review-amount'))
    article.append(heading)
    const details = node('dl', '', 'review-details')
    for (const [label, value] of [
      ['User ID', '@' + record.user_id], ['Email', record.email], ['Social ID', record.social_id || '—'],
      ['Submitted at', new Date(record.submitted_at).toLocaleString()], ['Payment reference', record.transaction_id],
      ['Note', record.notes || '—'], ['Request', record.request_id],
      ['Email delivery', record.status === 'pending' ? record.pending_email || 'waiting' : record.decision_email || 'waiting'],
    ]) details.append(node('dt', label), node('dd', value))
    article.append(details)
    const actions = node('div', '', 'review-actions')
    async function act(action: string, decision?: string) {
      const buttons = [...actions.querySelectorAll('button')]
      buttons.forEach(button => button.disabled = true)
      status.textContent = 'Saving…'
      try {
        const result = await api(action, { request_id: record.request_id, ...(decision ? { status: decision } : {}) })
        status.textContent = result.emailSent
          ? 'Saved. Email delivered.'
          : 'Saved. Email is in progress or needs a retry; refresh to check delivery.'
        await load()
      } catch (error) { status.textContent = (error as Error).message }
      finally { buttons.forEach(button => button.disabled = false) }
    }
    if (record.status === 'pending') {
      for (const [label, decision, className] of [['Approve & publish', 'approved', 'primary-button'], ['Reject', 'rejected', 'quiet-button']]) {
        const button = document.createElement('button')
        button.textContent = label; button.className = className
        button.addEventListener('click', () => void act('review', decision))
        actions.append(button)
      }
    }
    const emailStatus = record.status === 'pending' ? record.pending_email : record.decision_email
    if (emailStatus !== 'sent') {
      const retry = document.createElement('button')
      retry.textContent = 'Retry email'; retry.className = 'quiet-button'
      retry.addEventListener('click', () => void act('retry-email'))
      actions.append(retry)
    }
    article.append(actions)
    list.append(article)
  }
}
filter.addEventListener('change', render)
document.querySelector('#admin-refresh')!.addEventListener('click', () => void load())
document.querySelector('#send-login')!.addEventListener('click', async event => {
  const button = event.currentTarget as HTMLButtonElement
  button.disabled = true
  try { status.textContent = (await api('login-link', {})).message }
  catch (error) { status.textContent = (error as Error).message }
  finally { button.disabled = false }
})
document.querySelector('#admin-logout')!.addEventListener('click', async () => {
  signingOut = true
  generation++
  try {
    await api('logout', {})
    generation++
    records = []; list.replaceChildren(); login.hidden = false; content.hidden = true
    status.textContent = 'Signed out.'
  } catch (error) { status.textContent = (error as Error).message }
  finally { signingOut = false }
})
async function start() {
  const token = new URLSearchParams(location.hash.slice(1)).get('token')
  if (token) {
    history.replaceState(null, '', location.pathname)
    try { await api('login', { token }); status.textContent = 'Signed in.' }
    catch (error) { status.textContent = (error as Error).message; return }
  }
  await load()
}
void start()
