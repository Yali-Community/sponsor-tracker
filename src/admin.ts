import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-600.css'
import './style.css'

interface Review {
  request_id: string; name: string; user_id: string; email: string; social_id: string
  amount: string; submitted_at: string; transaction_id: string; notes: string; photo_path: string
  status: 'pending' | 'approved' | 'rejected' | 'revoked'; pending_email: string; decision_email: string
  returning_user_verified?: string
}
const status = document.querySelector<HTMLParagraphElement>('#admin-message')!
const login = document.querySelector<HTMLElement>('#admin-login')!
const content = document.querySelector<HTMLElement>('#admin-content')!
const list = document.querySelector('#review-list')!
const search = document.querySelector<HTMLInputElement>('#review-search')!
const filters = document.querySelectorAll<HTMLButtonElement>('[data-status]')
let activeStatus = 'pending'
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
  filters.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.status === activeStatus))
    button.querySelector('[data-count]')!.textContent = String(records.filter(record => record.status === button.dataset.status).length)
  })
  const query = search.value.trim().toLowerCase()
  const filtered = records.filter(record => record.status === activeStatus &&
    [record.name, record.user_id, record.email, record.transaction_id].some(value => value.toLowerCase().includes(query)))
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
  if (!filtered.length) {
    const empty = node('div', '', 'review-empty')
    empty.append(node('h3', query ? 'No matching requests' : activeStatus === 'pending' ? 'You’re all caught up.' : `No ${activeStatus} requests yet.`),
      node('p', query ? 'Try another name, user ID or payment reference.' : 'New submissions will appear in Pending, ready for your review.'))
    list.append(empty)
  }
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
    else heading.append(node('span', record.name.split(/\s+/).slice(0, 2).map(part => part[0]).join(''), 'review-initials'))
    const identity = node('div', '', 'review-identity')
    identity.append(node('h2', record.name), node('p', '@' + record.user_id))
    const amount = node('div', '', 'review-amount')
    amount.append(node('strong', new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(record.amount))), node('span', record.status, `review-badge ${record.status}`))
    heading.append(identity, amount)
    article.append(heading)
    if (records.some(other => other.request_id !== record.request_id && other.user_id === record.user_id)) {
      article.append(node('p', `Existing user ID · ${record.returning_user_verified === 'yes' ? 'Saved email verified for this contribution.' : 'Another request uses this ID.'} Verify this payment before approving. Approval adds this amount to the existing profile.`, 'review-repeat'))
    }
    const details = node('dl', '', 'review-details')
    for (const [label, value] of [
      ['Email', record.email], ['Social ID', record.social_id || '—'],
      ['Submitted at', new Date(record.submitted_at).toLocaleString()], ['Payment reference', record.transaction_id],
      ['Note', record.notes || '—'],
      ['Email delivery', record.status === 'pending' ? record.pending_email || 'waiting' : record.decision_email || 'waiting'],
    ]) details.append(node('dt', label), node('dd', value))
    article.append(details)
    const reference = node('details', '', 'review-reference')
    reference.append(node('summary', 'Request reference'), node('p', record.request_id))
    article.append(reference)
    const actions = node('div', '', 'review-actions')
    async function act(action: string, decision?: string) {
      if (decision === 'revoked' && !window.confirm(`Revoke this ₹${record.amount} contribution from @${record.user_id}? It will be removed from the public wall and total. This does not issue a refund.`)) return
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
    if (record.status === 'approved') {
      const revoke = document.createElement('button')
      revoke.textContent = 'Revoke approval'; revoke.className = 'quiet-button danger-button'
      revoke.addEventListener('click', () => void act('review', 'revoked'))
      actions.append(revoke)
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
filters.forEach(button => button.addEventListener('click', () => { activeStatus = button.dataset.status!; render() }))
search.addEventListener('input', render)
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
