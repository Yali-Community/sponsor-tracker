const dialog = document.querySelector<HTMLDialogElement>('#sponsor-dialog')!
const form = document.querySelector<HTMLFormElement>('#sponsor-form')!
const message = document.querySelector<HTMLParagraphElement>('#form-message')!
const submit = form.querySelector<HTMLButtonElement>('button[type=submit]')!
const success = document.querySelector<HTMLElement>('#submission-success')!
let requestId = crypto.randomUUID()
let completed = false
const userId = form.elements.namedItem('user_id') as HTMLInputElement
const userStatus = document.querySelector<HTMLElement>('#user-id-status')!
const warning = document.querySelector<HTMLElement>('#existing-user-warning')!
const sendCode = document.querySelector<HTMLButtonElement>('#send-sponsor-code')!
const verifyCode = document.querySelector<HTMLButtonElement>('#verify-sponsor-code')!
const codeEntry = document.querySelector<HTMLElement>('#code-entry')!
const codeInput = document.querySelector<HTMLInputElement>('#sponsor-code')!
const verificationMessage = document.querySelector<HTMLElement>('#verification-message')!
let challenge = ''
let verification = ''
let returning = false
function profileFields(hidden: boolean) {
  document.querySelectorAll<HTMLElement>('[data-profile-field]').forEach(label => {
    label.hidden = hidden
    label.querySelectorAll<HTMLInputElement>('input').forEach(input => input.disabled = hidden)
  })
}
let checkVersion = 0
let checkTimer: ReturnType<typeof setTimeout>
function setUserStatus(text: string, state = 'neutral') {
  userStatus.textContent = text
  userId.closest('label')!.dataset.idState = state
}
function showExisting() {
  warning.hidden = false
  returning = true
  profileFields(true)
  document.querySelector('#existing-user-copy')!.textContent = `@${userId.value.trim().toLowerCase()} is already registered. Verify the email saved for this ID to sponsor again. We’ll reuse the saved name, email and profile photo.`
  setUserStatus(verification ? 'Email verified. Ready for your next contribution.' : 'User ID already exists — verify your email to continue.', verification ? 'available' : 'taken')
}
function resetUserCheck() {
  checkVersion++
  clearTimeout(checkTimer)
  warning.hidden = true
  returning = false
  challenge = ''
  verification = ''
  codeInput.value = ''
  codeEntry.hidden = true
  sendCode.hidden = false
  verificationMessage.textContent = ''
  profileFields(false)
  setUserStatus('Letters, numbers, dots or underscores.')
}
async function checkUserId() {
  const version = ++checkVersion
  const id = userId.value.trim().toLowerCase()
  if (!/^[a-z0-9._]{1,30}$/.test(id)) return false
  setUserStatus('Checking user ID…')
  try {
    const response = await fetch(`/api/sponsorship?action=check-user-id&user_id=${encodeURIComponent(id)}`)
    if (!response.ok) throw new Error()
    const result = await response.json()
    if (version !== checkVersion) return false
    if (result.exists) showExisting()
    else { warning.hidden = true; returning = false; profileFields(false); setUserStatus('This user ID is available.', 'available') }
    return true
  } catch {
    if (version === checkVersion) setUserStatus('Could not check this ID. Please try again before submitting.', 'taken')
    return false
  }
}
userId.addEventListener('input', () => { resetUserCheck(); checkTimer = setTimeout(() => void checkUserId(), 400) })
userId.addEventListener('blur', () => { clearTimeout(checkTimer); void checkUserId() })
async function verificationApi(action: string, body: object) {
  const response = await fetch(`/api/sponsorship?action=${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Please try again.')
  return result
}
sendCode.addEventListener('click', async () => {
  const id = userId.value.trim().toLowerCase()
  sendCode.disabled = true
  verificationMessage.textContent = 'Sending a code to your saved email…'
  try {
    const result = await verificationApi('send-sponsor-code', { user_id: id, request_id: requestId })
    if (id !== userId.value.trim().toLowerCase()) return
    challenge = result.challenge
    codeEntry.hidden = false
    verificationMessage.textContent = 'Code sent to the email registered with this ID. It expires in 10 minutes.'
    codeInput.focus()
  } catch (error) { if (id === userId.value.trim().toLowerCase()) verificationMessage.textContent = (error as Error).message }
  finally { sendCode.disabled = false }
})
verifyCode.addEventListener('click', async () => {
  const activeChallenge = challenge
  verifyCode.disabled = true
  try {
    const result = await verificationApi('verify-sponsor-code', { challenge, code: codeInput.value.trim() })
    if (activeChallenge !== challenge) return
    verification = result.verification
    message.textContent = ''
    codeEntry.hidden = true
    sendCode.hidden = true
    verificationMessage.textContent = 'Email verified. Enter your new payment details below.'
    setUserStatus('Email verified.', 'available')
    ;(form.elements.namedItem('amount') as HTMLInputElement).focus()
  } catch (error) { if (activeChallenge === challenge) verificationMessage.textContent = (error as Error).message }
  finally { verifyCode.disabled = false }
})

document.querySelector('#sponsor-button')!.addEventListener('click', () => {
  if (completed) {
    completed = false
    requestId = crypto.randomUUID()
    form.reset()
    resetUserCheck()
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
  if (submit.disabled) return
  if (!form.reportValidity()) return
  submit.disabled = true
  submit.textContent = 'Sending…'
  message.textContent = ''
  try {
    clearTimeout(checkTimer)
    if (!await checkUserId()) throw new Error('Please check your user ID and try again.')
    if (returning && !verification) throw new Error('Verify your saved email before sending this contribution.')
    if (!form.reportValidity()) return
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
      verification,
    }
    const response = await fetch('/api/sponsorship?action=submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({ error: 'The service is unavailable. Please try again shortly.' }))
    if (!response.ok) {
      if (result.code === 'USER_ID_EXISTS') { verification = ''; verificationMessage.textContent = 'Please request a new verification code.'; sendCode.hidden = false; showExisting(); sendCode.focus() }
      throw new Error(result.error)
    }
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
