const dialog = document.querySelector<HTMLDialogElement>('#sponsor-dialog')!
const form = document.querySelector<HTMLFormElement>('#sponsor-form')!
const message = document.querySelector<HTMLParagraphElement>('#form-message')!
const submit = form.querySelector<HTMLButtonElement>('button[type=submit]')!
const success = document.querySelector<HTMLElement>('#submission-success')!
let requestId = crypto.randomUUID()
let completed = false

document.querySelector('#sponsor-button')!.addEventListener('click', () => {
  if (completed) {
    completed = false
    requestId = crypto.randomUUID()
    form.reset()
    form.hidden = false
    success.hidden = true
  }
  message.textContent = ''
  dialog.showModal()
})
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => dialog.close()))
dialog.addEventListener('click', event => { if (event.target === dialog) {
  const bounds = dialog.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close()
} })
form.addEventListener('submit', async event => {
  event.preventDefault()
  if (!form.reportValidity()) return
  submit.disabled = true
  submit.textContent = 'Sending…'
  message.textContent = ''
  try {
    const data = new FormData(form)
    const photo = data.get('photo') as File
    let photoData = ''
    if (photo?.size) {
      if (!['image/png', 'image/jpeg'].includes(photo.type) || photo.size > 1024 * 1024) throw new Error('Choose a PNG or JPEG photo under 1 MB.')
      photoData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Could not read the photo. Please try another.'))
        reader.readAsDataURL(photo)
      })
    }
    const payload = {
      request_id: requestId,
      user_id: data.get('user_id'), name: data.get('name'), email: data.get('email'),
      social_id: data.get('social_id'), amount: data.get('amount'),
      transaction_id: data.get('transaction_id'), notes: data.get('notes'),
      consent: data.get('consent') === 'on', website: data.get('website'), photo: photoData,
    }
    const response = await fetch('/api/sponsorship?action=submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({ error: 'The service is unavailable. Please try again shortly.' }))
    if (!response.ok) throw new Error(result.error)
    form.hidden = true
    success.hidden = false
    completed = true
    document.querySelector('#request-reference')!.textContent = `Request: ${result.request_id}`
    document.querySelector('#email-result')!.textContent = result.emailSent
      ? 'A confirmation has been sent to your email.'
      : 'Your request is saved. Email confirmation is delayed; you do not need to submit again.'
    success.focus()
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : 'Could not submit. Please try again.'
  } finally {
    submit.disabled = false
    submit.textContent = 'Send for review'
  }
})
