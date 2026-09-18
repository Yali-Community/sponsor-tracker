import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import './style.css'
import csv from '../sponsors.example.csv?raw'
import { parseSponsors, profileUrl, totalAmount, type Sponsor } from './sponsors'

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
try {
  const sponsors = parseSponsors(csv)
  const total = totalAmount(sponsors)
  app.replaceChildren()
  const summary = element('section', 'summary')
  summary.setAttribute('aria-label', 'Sponsorship summary')
  summary.append(element('p', 'muted', 'Total sponsored'), element('p', 'total', formatAmount(total)))
  summary.append(element('p', 'summary-copy', 'Small gestures. Shared momentum.'))
  const supporterCount = element('div', 'supporter-count')
  const stack = element('span', 'avatar-stack')
  sponsors.slice(0, 3).forEach((sponsor, index) => stack.append(avatar(sponsor, index)))
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

  function select(index: number, reveal = false) {
    const sponsor = sponsors[index]
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)))
    rows.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)))
    selected.replaceChildren()
    const heading = element('div', 'selected-heading')
    const identity = element('div', 'identity')
    identity.append(element('h3', '', sponsor.name))
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
    button.style.setProperty('--delay', `${Math.min(index * 35, 500)}ms`)
    button.setAttribute('aria-label', `${sponsor.name}, ${formatAmount(sponsor.amount)}. Show details`)
    button.setAttribute('aria-controls', selected.id)
    button.append(avatar(sponsor, index), element('span', 'sponsor-name', sponsor.name), element('span', 'sponsor-amount', formatAmount(sponsor.amount)))
    button.addEventListener('click', () => select(index, true))
    buttons.push(button)
    grid.append(button)
    const row = element('li', '')
    const rowButton = element('button', 'contribution')
    rowButton.type = 'button'
    rowButton.setAttribute('aria-controls', selected.id)
    rowButton.append(element('span', 'contributor-name', sponsor.name), element('span', 'contribution-amount', formatAmount(sponsor.amount)))
    rowButton.addEventListener('click', () => select(index, true))
    rows.push(rowButton)
    row.append(rowButton)
    list.append(row)
  })
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
  message.append(element('h2', '', 'We couldn’t load the sponsors.'), element('p', '', 'Check the sponsor CSV and rebuild the site.'))
  if (error instanceof Error) message.append(element('p', 'muted', error.message))
  app.replaceChildren(message)
}
