import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import '@fontsource/noto-sans-tamil/tamil-400.css'
import './style.css'
import './submission'
import csv from '../sponsors.example.csv?raw'
import { parseSponsors, profileUrl, relativePaymentTime, totalAmount, type Sponsor } from './sponsors'

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
})
const formatAmount = (amount: number) => currency.format(amount).replace(/\.00$/, '')
const app = document.querySelector<HTMLDivElement>('#sponsors-app')!

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = text
  return node
}
function avatar(sponsor: Sponsor, index: number) {
  const node = element('span', `avatar tone-${index % 5}`)
  node.setAttribute('aria-hidden', 'true')
  node.textContent = sponsor.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')
  const url = profileUrl(sponsor.profile_picture)
  if (url) {
    const image = document.createElement('img')
    image.alt = ''
    image.loading = 'lazy'
    image.referrerPolicy = 'no-referrer'
    image.addEventListener('error', () => image.remove(), { once: true })
    image.src = url
    node.append(image)
  }
  return node
}
async function loadSponsors() {
try {
  let sponsors: Sponsor[]
  let entries: Sponsor[]
  if (import.meta.env.DEV) {
    sponsors = parseSponsors(csv)
    entries = sponsors
  } else {
    const response = await fetch('/api/sponsorship?action=public')
    if (!response.ok) throw new Error('Please refresh the page in a moment.')
    const data = await response.json()
    sponsors = data.sponsors
    entries = data.contributions
  }
  const total = totalAmount(sponsors)
  const photos = sponsors.filter(sponsor => profileUrl(sponsor.profile_picture)).slice(0, 3)
  const sponsorPhotos = document.querySelector<HTMLElement>('#sponsor-photos')!
  photos.forEach(sponsor => {
    const image = document.createElement('img')
    image.alt = ''
    image.hidden = true
    image.referrerPolicy = 'no-referrer'
    image.addEventListener('load', () => { image.hidden = false; sponsorPhotos.hidden = false }, { once: true })
    image.addEventListener('error', () => {
      image.remove()
      sponsorPhotos.hidden = !sponsorPhotos.querySelector('img:not([hidden])')
    }, { once: true })
    image.src = profileUrl(sponsor.profile_picture)!
    sponsorPhotos.append(image)
  })
  app.replaceChildren()
  const summary = element('section', 'summary')
  summary.setAttribute('aria-label', 'Sponsorship summary')
  summary.append(element('p', 'muted', 'Total sponsored'), element('p', 'total', formatAmount(total)))
  summary.append(element('p', 'summary-copy', 'Small gestures. Shared momentum.'))
  const supporterCount = element('div', 'supporter-count')
  const stack = element('span', 'avatar-stack')
  photos.forEach((sponsor, index) => stack.append(avatar(sponsor, index)))
  supporterCount.append(stack, element('span', '', `${sponsors.length} ${sponsors.length === 1 ? 'sponsor' : 'sponsors'}`))
  summary.append(supporterCount)
  const selected = element('section', 'selected')
  selected.id = 'sponsor-details'
  selected.setAttribute('aria-live', 'polite')
  selected.setAttribute('aria-atomic', 'true')
  const contributions = element('section', 'contributions')
  contributions.append(element('h2', 'small-heading', 'Contributions'))
  const list = element('ul', 'contribution-list')
  const wall = element('section', 'wall')
  wall.setAttribute('aria-labelledby', 'wall-title')
  const wallHeading = element('div', 'wall-heading')
  const title = element('h2', '', 'Good people. Great support.')
  title.id = 'wall-title'
  wallHeading.append(title, element('p', 'muted', 'Meet the people making it possible.'))
  const grid = element('div', 'sponsor-grid')
  const buttons: HTMLButtonElement[] = []
  const rows: HTMLButtonElement[] = []

  function select(index: number, reveal = false, contribution?: Sponsor) {
    const sponsor = contribution || sponsors[index]
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)))
    rows.forEach((button, i) => button.setAttribute('aria-pressed', String(entries[i] === contribution)))
    selected.replaceChildren()
    const heading = element('div', 'selected-heading')
    const identity = element('div', 'identity')
    identity.append(element('h3', '', sponsor.name))
    identity.append(element('p', 'user-id', `@${sponsor.user_id}`))
    if (sponsor.social_id) identity.append(element('p', 'social-id', sponsor.social_id))
    heading.append(avatar(sponsor, index), identity)
    selected.append(heading, element('p', 'selected-amount', `${formatAmount(sponsor.amount)} contributed`))
    if (sponsor.notes) selected.append(element('p', 'notes', sponsor.notes))
    if (reveal && window.matchMedia('(max-width: 760px)').matches) {
      selected.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      })
    }
  }
  sponsors.forEach((sponsor, index) => {
    const button = element('button', 'sponsor')
    button.type = 'button'
    button.dataset.userId = sponsor.user_id
    button.style.setProperty('--delay', `${Math.min(index * 35, 500)}ms`)
    button.setAttribute('aria-label', `${sponsor.name}, ${formatAmount(sponsor.amount)}. Show details`)
    button.setAttribute('aria-controls', selected.id)
    button.append(avatar(sponsor, index), element('span', 'sponsor-name', sponsor.name), element('span', 'sponsor-amount', formatAmount(sponsor.amount)))
    button.addEventListener('click', () => select(index, true))
    buttons.push(button)
    grid.append(button)
  })
  entries.forEach((sponsor) => {
    const index = sponsors.findIndex(profile => profile.user_id === sponsor.user_id)
    const row = element('li', '')
    const rowButton = element('button', 'contribution')
    rowButton.type = 'button'
    rowButton.dataset.userId = sponsor.user_id
    rowButton.setAttribute('aria-controls', selected.id)
    const activity = element('span', 'activity')
    const sentence = element('span', 'activity-sentence')
    sentence.append(element('strong', '', sponsor.name), document.createTextNode(' paid '), element('strong', '', formatAmount(sponsor.amount)))
    const meta = element('span', 'activity-meta')
    const time = element('time', 'payment-time', relativePaymentTime(sponsor.paid_at))
    time.dateTime = sponsor.paid_at
    time.title = new Date(sponsor.paid_at).toLocaleString()
    meta.append(element('span', 'user-id', `@${sponsor.user_id}`), document.createTextNode(' · submitted '), time)
    activity.append(sentence, meta)
    rowButton.append(avatar(sponsor, index), activity)
    rowButton.addEventListener('click', () => select(index, true, sponsor))
    rows.push(rowButton)
    row.append(rowButton)
    row.dataset.paidAt = sponsor.paid_at
    list.append(row)
  })
  list.replaceChildren(...Array.from(list.children).sort((a, b) =>
    Date.parse((b as HTMLElement).dataset.paidAt!) - Date.parse((a as HTMLElement).dataset.paidAt!)))
  window.setInterval(() => {
    list.querySelectorAll<HTMLTimeElement>('time').forEach((time) => {
      time.textContent = relativePaymentTime(time.dateTime)
    })
  }, 30000)
  contributions.append(list)
  wall.append(wallHeading, grid)
  if (sponsors.length) {
    select(0)
    wall.append(element('p', 'wall-hint', 'Every circle has a story. Select one to see their contribution.'))
  } else {
    selected.hidden = true
    contributions.hidden = true
    wall.append(element('p', 'empty-state', 'A little space for our first supporters.'))
  }
  app.append(summary, wall, selected, contributions)
} catch (error) {
  const message = element('div', 'error-state')
  message.setAttribute('role', 'alert')
  message.append(element('h2', '', 'We couldn’t load the sponsors.'), element('p', '', 'Please refresh the page in a moment.'))
  if (error instanceof Error) message.append(element('p', 'muted', error.message))
  app.replaceChildren(message)
}
}
void loadSponsors()
