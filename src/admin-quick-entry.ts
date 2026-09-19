import type { Review } from './admin'

export function quickEntry(api: (action: string, data?: object) => Promise<any>, reload: () => Promise<void>) {
  const form = document.querySelector<HTMLFormElement>('#quick-entry-form')!
  const username = form.elements.namedItem('user_id') as HTMLInputElement
  const amount = form.elements.namedItem('amount') as HTMLInputElement
  const button = form.querySelector<HTMLButtonElement>('button')!
  const hint = document.querySelector('#quick-entry-hint')!
  const result = document.querySelector('#quick-entry-result')!
  const suggestions = document.querySelector('#quick-usernames')!
  let records: Review[] = [], requestId = crypto.randomUUID(), generation = 0
  function describe() {
    const id = username.value.trim().toLowerCase()
    const user = records.find(row => row.user_id.toLowerCase() === id)
    hint.textContent = !id ? 'Only a username and amount are needed. No confirmation email is sent.' : user
      ? `Existing user · ${user.name}. This adds a contribution and keeps their saved profile.`
      : `New user · @${id}. Their display name will be ${id}, with a heart icon. You can edit the profile in All users later.`
  }
  username.addEventListener('input', describe)
  form.addEventListener('submit', async event => {
    event.preventDefault()
    if (button.disabled || !form.reportValidity()) return
    const current = generation
    const payload = { request_id: requestId, user_id: username.value.trim().toLowerCase(), amount: amount.value }
    button.disabled = true; username.disabled = true; amount.disabled = true
    button.textContent = 'Saving…'; result.textContent = ''
    try {
      const saved = await api('admin-add', payload)
      if (current !== generation) return
      result.textContent = saved.status === 'approved' ? `Saved and published for @${payload.user_id}.` : `This entry was already saved and is now ${saved.status}. Check its contribution history.`
      requestId = crypto.randomUUID(); form.reset(); describe()
      await reload()
    } catch (error) { if (current === generation) result.textContent = (error as Error).message }
    finally {
      button.disabled = false; username.disabled = false; amount.disabled = false; button.textContent = 'Add & publish'
    }
  })
  return {
    setRecords(incoming: Review[]) {
      records = incoming; suggestions.replaceChildren()
      for (const id of new Set(records.map(row => row.user_id))) {
        const option = document.createElement('option'); option.value = id; suggestions.append(option)
      }
      describe()
    },
    clear() { generation++; records = []; suggestions.replaceChildren(); form.reset(); result.textContent = ''; requestId = crypto.randomUUID(); describe() },
  }
}
