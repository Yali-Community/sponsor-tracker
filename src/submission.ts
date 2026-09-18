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
const emailForm = document.querySelector<HTMLFormElement>('#email-verification-form')!
const emailInput = document.querySelector<HTMLInputElement>('#verification-email')!
const emailStep = document.querySelector<HTMLElement>('#email-step')!
const detailsStep = document.querySelector<HTMLElement>('#sponsorship-details')!
let challenge = ''
let verification = ''
let verifiedEmail = ''
let returning = false
let matchesEmail = false
let checkVersion = 0
let emailVersion = 0
let checkTimer: ReturnType<typeof setTimeout>
function profileFields(hidden: boolean) {
  document.querySelectorAll<HTMLElement>('[data-profile-field]').forEach(label => {
    label.hidden = hidden
    label.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach(input => input.disabled = hidden)
  })
}
function setUserStatus(text: string, state = 'neutral') {
  userStatus.textContent = text
  userId.closest('label')!.dataset.idState = state
}
function resetUserCheck() {
  checkVersion++; clearTimeout(checkTimer)
  warning.hidden = true; returning = false; matchesEmail = false
  profileFields(false)
  setUserStatus('Letters, numbers, dots or underscores.')
}
function startEmail() {
  emailVersion++; verification = ''; verifiedEmail = ''; challenge = ''
  codeInput.value = ''; codeInput.required = false; codeEntry.hidden = true; verifyCode.hidden = true
  verificationMessage.textContent = ''; sendCode.textContent = 'Send code'
  emailStep.hidden = false; detailsStep.hidden = true
  dialog.classList.add('verifying-email'); dialog.setAttribute('aria-labelledby', 'email-step-title')
  resetUserCheck(); emailInput.focus()
}
async function verificationApi(action: string, body: object) {
  const response = await fetch(`/api/sponsorship?action=${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json()
  if (!response.ok) {
    if (result.code === 'EMAIL_VERIFICATION_REQUIRED') startEmail()
    throw new Error(result.error || 'Please try again.')
  }
  return result
}
async function checkUserId() {
  const version = ++checkVersion
  const id = userId.value.trim().toLowerCase()
  if (!verification || !/^[a-z0-9._]{1,30}$/.test(id)) return false
  setUserStatus('Checking username…')
  try {
    const result = await verificationApi('check-verified-user', { user_id: id, email: verifiedEmail, verification, request_id: requestId })
    if (version !== checkVersion) return false
    returning = result.exists; matchesEmail = result.matchesEmail
    warning.hidden = !returning; profileFields(returning)
    document.querySelector('#existing-user-copy')!.textContent = matchesEmail
      ? 'Your email matches this account. We’ll reuse its saved profile for this contribution.'
      : 'This username belongs to a different email. Change email above and verify the saved address, or choose another username.'
    setUserStatus(returning ? matchesEmail ? 'Existing account verified.' : 'Username taken — email does not match.' : 'This username is available.', !returning || matchesEmail ? 'available' : 'taken')
    return !returning || matchesEmail
  } catch (error) {
    if (emailStep.hidden && version === checkVersion) setUserStatus((error as Error).message, 'taken')
    else if (!emailStep.hidden) verificationMessage.textContent = (error as Error).message
    return false
  }
}
userId.addEventListener('input', () => { resetUserCheck(); checkTimer = setTimeout(() => void checkUserId(), 400) })
userId.addEventListener('blur', () => { clearTimeout(checkTimer); void checkUserId() })
emailInput.addEventListener('input', startEmail)
document.querySelector('#change-email')!.addEventListener('click', startEmail)
sendCode.addEventListener('click', async () => {
  if (!emailInput.reportValidity()) return
  const version = ++emailVersion
  sendCode.disabled = true; verificationMessage.textContent = 'Sending your code…'
  try {
    const result = await verificationApi('send-email-code', { email: emailInput.value, request_id: requestId })
    if (version !== emailVersion) return
    challenge = result.challenge; codeEntry.hidden = false; codeInput.required = true; verifyCode.hidden = false
    sendCode.textContent = 'Resend code'
    verificationMessage.textContent = 'Code sent. Check your inbox or spam folder. It expires in 10 minutes.'
    codeInput.focus()
  } catch (error) { if (version === emailVersion) verificationMessage.textContent = (error as Error).message }
  finally { sendCode.disabled = false }
})
emailForm.addEventListener('submit', async event => {
  event.preventDefault()
  if (!challenge) { sendCode.click(); return }
  if (verifyCode.disabled || !emailForm.reportValidity()) return
  const activeChallenge = challenge, version = emailVersion
  verifyCode.disabled = true
  try {
    const result = await verificationApi('verify-sponsor-code', { challenge, code: codeInput.value.trim() })
    if (activeChallenge !== challenge || version !== emailVersion) return
    verification = result.verification; verifiedEmail = emailInput.value.trim().toLowerCase()
    emailStep.hidden = true; detailsStep.hidden = false
    dialog.classList.remove('verifying-email'); dialog.setAttribute('aria-labelledby', 'sponsor-dialog-title')
    document.querySelector('#verified-email-label')!.textContent = `Verified · ${verifiedEmail}`
    message.textContent = ''; userId.focus()
    if (userId.value) void checkUserId()
  } catch (error) { if (activeChallenge === challenge) verificationMessage.textContent = (error as Error).message }
  finally { verifyCode.disabled = false }
})
const socialPlatform = form.elements.namedItem('social_platform') as HTMLSelectElement
const socialInput = form.elements.namedItem('social_id') as HTMLInputElement
socialPlatform.addEventListener('change', () => {
  const custom = socialPlatform.value === 'custom'
  socialInput.type = custom ? 'url' : 'text'
  socialInput.placeholder = custom ? 'https://your-website.com' : socialPlatform.value === 'instagram' ? '@yourname or https://instagram.com/yourname' : '@yourname or https://x.com/yourname'
  document.querySelector('#social-input-label')!.textContent = custom ? 'Website or profile link' : 'Handle or profile link'
})
startEmail()
document.querySelector('#sponsor-button')!.addEventListener('click', () => {
  if (completed) {
    completed = false
    requestId = crypto.randomUUID()
    form.reset()
    startEmail()
    socialPlatform.dispatchEvent(new Event('change'))
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
    if (!await checkUserId()) throw new Error('Please check your username and try again.')
    if (!verification || (returning && !matchesEmail)) throw new Error('Verify your saved email before sending this contribution.')
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
      user_id: data.get('user_id'), name: data.get('name'), email: verifiedEmail,
      social_platform: data.get('social_platform'), social_id: data.get('social_id'), amount: data.get('amount'),
      transaction_id: data.get('transaction_id'), notes: data.get('notes'),
      consent: data.get('consent') === 'on', website: data.get('website'), photo: photoData,
      verification,
    }
    const response = await fetch('/api/sponsorship?action=submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({ error: 'The service is unavailable. Please try again shortly.' }))
    if (!response.ok) {
      if (result.code === 'EMAIL_VERIFICATION_REQUIRED') { startEmail(); verificationMessage.textContent = result.error }
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
