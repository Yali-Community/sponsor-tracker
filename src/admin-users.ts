import type { Review } from './admin'
import { avatarOptions, avatarIconUrl } from './avatar-options'

interface User {
  request_id: string; user_id: string; name: string; email: string; social_id: string
  photo_path: string; version: string; contributions: number; approved_amount: number
  avatar_icon?: string
  delete_version: string
}
const money = (amount: number | string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(amount))
function element(tag: string, text = '', className = '') {
  const node = document.createElement(tag)
  node.textContent = text; node.className = className
  return node
}
export function userManager(api: (action: string, data?: object) => Promise<any>, reload: () => Promise<void>) {
  const list = document.querySelector('#users-list')!
  const search = document.querySelector<HTMLInputElement>('#user-search')!
  const dialog = document.querySelector<HTMLDialogElement>('#admin-editor')!
  const form = document.querySelector<HTMLFormElement>('#admin-edit-form')!
  const fields = document.querySelector('#editor-fields')!
  const error = document.querySelector('#editor-error')!
  const save = document.querySelector<HTMLButtonElement>('#editor-save')!
  let users: User[] = []
  let records: Review[] = []
  let editing: { action: string; request_id: string; version: string } | undefined
  let saving = false

  function field(label: string, name: string, value: string, type = 'text', max = 100, required = true) {
    const wrapper = element('label', label)
    const input = document.createElement('input')
    input.name = name; input.type = type; input.value = value; input.maxLength = max; input.required = required
    if (name === 'amount') { input.min = '0.01'; input.max = '1000000'; input.step = '0.01' }
    if (name === 'user_id') { input.pattern = '[a-zA-Z0-9._]{1,30}'; input.autocapitalize = 'none'; input.spellcheck = false }
    wrapper.append(input); fields.append(wrapper)
    return input
  }
  function open(title: string, description: string, action: string, record: User | Review) {
    form.reset(); fields.replaceChildren(); error.textContent = ''
    editing = { action, request_id: record.request_id, version: record.version }
    document.querySelector('#editor-title')!.textContent = title
    document.querySelector('#editor-description')!.textContent = description
  }
  function editUser(user: User) {
    open('Edit user', 'Profile changes apply to all of this user’s contributions. A new email will be used for future verification codes.', 'edit-user', user)
    field('Name', 'name', user.name, 'text', 80)
    field('Username', 'user_id', user.user_id, 'text', 30)
    field(user.email ? 'Email' : 'Email (optional)', 'email', user.email, 'email', 254, Boolean(user.email))
    field('Social ID (optional)', 'social_id', user.social_id, 'text', 100, false)
    const iconLabel = element('label', 'Profile icon (used without a photo)')
    const iconSelect = document.createElement('select')
    iconSelect.name = 'avatar_icon'
    for (const value of ['', ...avatarOptions]) {
      const option = document.createElement('option'); option.value = value
      option.textContent = value ? value[0].toUpperCase() + value.slice(1) : 'Initials'
      iconSelect.append(option)
    }
    iconSelect.value = user.avatar_icon || ''; iconLabel.append(iconSelect); fields.append(iconLabel)
    const photo = field('Replace profile photo (optional)', 'photo', '', 'file', 100, false)
    photo.accept = 'image/png,image/jpeg'
    photo.parentElement!.append(element('small', 'PNG or JPEG, up to 1 MB. Leave empty to keep the current photo.'))
    if (user.photo_path) {
      const remove = field('Remove current photo', 'remove_photo', '', 'checkbox', 100, false)
      remove.parentElement!.classList.add('editor-checkbox')
    }
    dialog.showModal()
  }
  function editContribution(record: Review) {
    open('Edit contribution', `For @${record.user_id}. Approved amount and note changes appear publicly immediately. Review status and submission time stay unchanged.`, 'edit-contribution', record)
    field('Amount (₹)', 'amount', record.amount, 'number', 12)
    field('Payment reference', 'transaction_id', record.transaction_id, 'text', 100)
    const label = element('label', 'Notes (optional)', 'editor-full')
    const note = document.createElement('textarea')
    note.name = 'notes'; note.value = record.notes; note.maxLength = 500; note.rows = 3
    label.append(note); fields.append(label)
    dialog.showModal()
  }
  function button(label: string, action: () => void) {
    const node = document.createElement('button')
    node.type = 'button'; node.className = 'quiet-button'; node.textContent = label
    node.addEventListener('click', action)
    return node
  }
  function render() {
    list.replaceChildren()
    document.querySelector('#user-count')!.textContent = String(users.length)
    const query = search.value.trim().toLowerCase()
    const matching = users.filter(user => [user.name, user.user_id, user.email, user.social_id].some(value => value.toLowerCase().includes(query)))
      .sort((a, b) => a.name.localeCompare(b.name))
    if (!matching.length) {
      const empty = element('div', '', 'review-empty')
      empty.append(element('h3', query ? 'No matching users' : 'No users yet'), element('p', query ? 'Try a different name, username or email.' : 'Anyone who submits a contribution will appear here.'))
      list.append(empty)
    }
    for (const user of matching) {
      const row = element('article', '', 'user-row')
      const identity = element('div', '', 'user-identity')
      if (user.photo_path || avatarIconUrl(user.avatar_icon)) {
        const image = document.createElement('img')
        image.src = user.photo_path ? `/api/sponsorship?action=photo&id=${encodeURIComponent(user.request_id)}&v=${user.version}` : avatarIconUrl(user.avatar_icon)
        image.alt = ''; image.width = 44; image.height = 44
        identity.append(image)
      } else identity.append(element('span', user.name.slice(0, 1), 'review-initials'))
      const name = element('div')
      name.append(element('h3', user.name), element('p', '@' + user.user_id))
      identity.append(name)
      const contact = element('div', '', 'user-contact')
      contact.append(element('p', user.email || 'No email added'), element('p', user.social_id || 'No social ID', 'user-muted'))
      const total = element('div', '', 'user-total')
      total.append(element('strong', money(user.approved_amount)), element('p', `${user.contributions} contribution${user.contributions === 1 ? '' : 's'} · approved total`))
      row.append(identity, contact, total, button('Edit user', () => editUser(user)))
      const history = document.createElement('details')
      history.className = 'user-history'
      history.append(element('summary', 'View contributions & edit amounts'))
      for (const record of records.filter(record => record.user_id.toLowerCase() === user.user_id.toLowerCase()).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))) {
        const contribution = element('div', '', 'user-contribution')
        const info = element('div')
        info.append(element('strong', money(record.amount)), element('span', record.status, `review-badge ${record.status}`), element('p', `${new Date(record.submitted_at).toLocaleString()} · ${record.transaction_id}`))
        if (record.notes) info.append(element('p', record.notes))
        contribution.append(info, button('Edit amount & details', () => editContribution(record)))
        history.append(contribution)
      }
      const remove = button('Delete user & contributions', () => {
        const confirmation = window.prompt(`Permanently delete @${user.user_id} and all ${user.contributions} contributions? ${money(user.approved_amount)} will be removed from the public total. This cannot be undone and does not refund payments. Type ${user.user_id} to confirm.`)
        if (confirmation !== user.user_id) return
        remove.disabled = true
        void (async () => {
          try {
            await api('delete-user', { request_id: user.request_id, delete_version: user.delete_version, confirm_username: confirmation })
            document.querySelector('#admin-message')!.textContent = `Deleted @${user.user_id} and their contributions.`
            await reload()
          } catch (failure) { document.querySelector('#admin-message')!.textContent = (failure as Error).message }
          finally { remove.disabled = false }
        })()
      })
      remove.classList.add('danger-button')
      history.append(remove)
      row.append(history); list.append(row)
    }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (!editing || saving || !form.reportValidity()) return
    saving = true; save.disabled = true; save.textContent = 'Saving…'; error.textContent = ''
    const edit = editing
    try {
      const data = new FormData(form)
      const payload: Record<string, unknown> = { ...edit }
      for (const [key, value] of data) if (typeof value === 'string') payload[key] = value
      const photo = data.get('photo')
      if (photo instanceof File && photo.size) {
        if (photo.size > 1024 * 1024 || !['image/png', 'image/jpeg'].includes(photo.type)) throw new Error('Choose a PNG or JPEG photo under 1 MB.')
        payload.photo = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this photo. Choose it again.'))
          reader.readAsDataURL(photo)
        })
      }
      payload.remove_photo = data.has('remove_photo')
      await api(edit.action, payload)
      dialog.close()
      document.querySelector('#admin-message')!.textContent = 'Changes saved.'
      await reload()
    } catch (failure) { if (dialog.open) error.textContent = (failure as Error).message }
    finally { saving = false; save.disabled = false; save.textContent = 'Save changes' }
  })
  dialog.addEventListener('cancel', event => { if (saving) event.preventDefault() })
  dialog.addEventListener('close', () => { fields.replaceChildren(); editing = undefined; error.textContent = '' })
  for (const id of ['editor-close', 'editor-cancel']) document.getElementById(id)!.addEventListener('click', () => { if (!saving) dialog.close() })
  search.addEventListener('input', render)
  document.querySelector('#users-refresh')!.addEventListener('click', () => void reload())
  function section(usersVisible: boolean) {
    document.querySelector<HTMLElement>('#users-panel')!.hidden = !usersVisible
    document.querySelector<HTMLElement>('#contributions-panel')!.hidden = usersVisible
    document.querySelector('#show-users')!.setAttribute('aria-pressed', String(usersVisible))
    document.querySelector('#show-reviews')!.setAttribute('aria-pressed', String(!usersVisible))
    document.querySelector('#admin-section-title')!.textContent = usersVisible ? 'All your sponsors' : 'Your review queue'
    document.querySelector('#admin-section-description')!.textContent = usersVisible ? 'One profile per username. Manage details and contribution history here.' : 'Check each payment in your UPI account before publishing.'
  }
  document.querySelector('#show-users')!.addEventListener('click', () => section(true))
  document.querySelector('#show-reviews')!.addEventListener('click', () => section(false))
  return {
    setData(incoming: User[], contributions: Review[]) { users = incoming; records = contributions; render() },
    clear() { users = []; records = []; list.replaceChildren(); search.value = ''; dialog.close(); fields.replaceChildren(); editing = undefined },
    editContribution,
  }
}
