import { profilePicker } from './profile-picker'
const dialog = document.querySelector<HTMLDialogElement>('#sponsor-dialog')!
const form = document.querySelector<HTMLFormElement>('#sponsor-form')!
const message = document.querySelector<HTMLParagraphElement>('#form-message')!
const submit = form.querySelector<HTMLButtonElement>('button[type=submit]')!
const success = document.querySelector<HTMLElement>('#submission-success')!
const picker = profilePicker(form)
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
const usernameStep = document.querySelector<HTMLFieldSetElement>('#username-step')!
const profileStep = document.querySelector<HTMLFieldSetElement>('#profile-step')!
const paymentStep = document.querySelector<HTMLFieldSetElement>('#payment-step')!
const nextUsername = document.querySelector<HTMLButtonElement>('#username-next')!
const back = document.querySelector<HTMLButtonElement>('#form-back')!
let step: 'username' | 'profile' | 'payment' = 'username'
function showStep(value: typeof step) {
  step = value
  usernameStep.hidden = value !== 'username'
  profileStep.hidden = value !== 'profile'
  profileStep.disabled = returning || value === 'username'
  paymentStep.hidden = value !== 'payment'
  paymentStep.disabled = value !== 'payment'
  document.querySelector<HTMLElement>('.payment-panel')!.hidden = value !== 'payment'
  document.querySelector<HTMLElement>('.consent')!.hidden = value !== 'payment'
  ;(form.elements.namedItem('consent') as HTMLInputElement).disabled = value !== 'payment'
  submit.hidden = value !== 'payment'
  back.hidden = value === 'username'
  detailsStep.classList.toggle('account-layout', value !== 'payment')
  dialog.classList.toggle('account-dialog', value !== 'payment')
  document.querySelector('#wizard-progress')!.textContent = value === 'username' ? 'Username → Profile → Payment' : value === 'profile' ? 'Username checked · Your profile → Payment' : 'Profile confirmed · Payment & review'
  document.querySelector('#payment-account')!.textContent = returning ? `Adding to @${userId.value.trim().toLowerCase()}. Your saved name, photo or icon and social profile will be reused.` : `For @${userId.value.trim().toLowerCase()}. Scan to pay, then enter the amount and payment reference.`
  message.textContent = ''
  dialog.scrollTop = 0
  if (value === 'username') userId.focus()
  else if (value === 'profile') (form.elements.namedItem('name') as HTMLInputElement).focus()
  else (form.elements.namedItem('amount') as HTMLInputElement).focus()
}
function accountNotice(title: string, copy: string, state = 'neutral') {
  warning.dataset.state = state
  warning.querySelector('.warning-title')!.textContent = title
  document.querySelector('#existing-user-copy')!.textContent = copy
}
function setUserStatus(text: string, state = 'neutral') {
  userStatus.textContent = text
  userId.closest('label')!.dataset.idState = state
}
function resetUserCheck() {
  checkVersion++; clearTimeout(checkTimer)
  returning = false; matchesEmail = false
  nextUsername.disabled = true
  accountNotice('Choose your username', 'We’ll check whether it is available or belongs to your verified email.')
  setUserStatus('Letters, numbers, dots or underscores.')
}
function startEmail() {
  emailVersion++; verification = ''; verifiedEmail = ''; challenge = ''
  codeInput.value = ''; codeInput.required = false; codeEntry.hidden = true; verifyCode.hidden = true
  verificationMessage.textContent = ''; sendCode.textContent = 'Send code'
  emailStep.hidden = false; detailsStep.hidden = true
  dialog.classList.add('verifying-email'); dialog.setAttribute('aria-labelledby', 'email-step-title')
  resetUserCheck(); showStep('username'); emailInput.focus()
}
async function verificationApi(action: string, body: object) {
  const response = await fetch(`/api/sponsorship?action=${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const result = await response.json()
  if (!response.ok) {
    throw Object.assign(new Error(result.error || 'Please try again.'), { code: result.code })
  }
  return result
}
async function checkUserId() {
  const version = ++checkVersion
  const id = userId.value.trim().toLowerCase()
  if (!verification || !/^[a-z0-9._]{1,30}$/.test(id)) { nextUsername.disabled = true; accountNotice('Check your username', 'Use 1–30 letters, numbers, dots or underscores.', 'error'); return false }
  nextUsername.disabled = true
  setUserStatus('Checking username…')
  accountNotice('Checking username…', 'Please wait while we check your account.')
  try {
    const result = await verificationApi('check-verified-user', { user_id: id, email: verifiedEmail, verification, request_id: requestId })
    if (version !== checkVersion) return false
    returning = result.exists; matchesEmail = result.matchesEmail
    nextUsername.disabled = returning && !matchesEmail
    nextUsername.textContent = returning && matchesEmail ? 'Continue with saved profile' : 'Continue'
    accountNotice(returning ? matchesEmail ? 'Welcome back — your account is verified' : 'This username belongs to another email' : 'This username is available',
      returning ? matchesEmail ? 'Your saved profile will be reused. Continue to enter a new contribution.' : 'Choose a different username, or use Change email above to verify this account’s saved address. You cannot continue with this email.' : 'Continue to add your name and choose a profile icon or photo.',
      returning && !matchesEmail ? 'error' : 'success')
    setUserStatus(returning ? matchesEmail ? 'Existing account verified.' : 'Username taken — email does not match.' : 'This username is available.', !returning || matchesEmail ? 'available' : 'taken')
    return !returning || matchesEmail
  } catch (error) {
    if (version !== checkVersion) return false
    if ((error as { code?: string }).code === 'EMAIL_VERIFICATION_REQUIRED') startEmail()
    if (emailStep.hidden && version === checkVersion) { setUserStatus('Could not check username.', 'taken'); accountNotice('Could not check username', (error as Error).message + ' Edit the username to retry.', 'error') }
    else if (!emailStep.hidden) verificationMessage.textContent = (error as Error).message
    return false
  }
}
userId.addEventListener('input', () => { resetUserCheck(); checkTimer = setTimeout(() => void checkUserId(), 400) })
nextUsername.addEventListener('click', () => {
  if (nextUsername.disabled) return
  showStep(returning && matchesEmail ? 'payment' : 'profile')
})
document.querySelector('#profile-next')!.addEventListener('click', () => {
  if (form.reportValidity()) showStep('payment')
})
back.addEventListener('click', () => showStep(step === 'payment' && !returning ? 'profile' : 'username'))
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
    showStep('username')
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
    picker.reset()
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
  if (step === 'username') { nextUsername.click(); return }
  if (step === 'profile') { document.querySelector<HTMLButtonElement>('#profile-next')!.click(); return }
  if (!form.reportValidity()) return
  submit.disabled = true
  form.inert = true
  submit.textContent = 'Sending…'
  message.textContent = ''
  try {
    clearTimeout(checkTimer)
    if (!await checkUserId()) { if (emailStep.hidden) showStep('username'); throw new Error('Please resolve the username warning before continuing.') }
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
      avatar_icon: data.get('avatar_icon'), verification,
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
    form.inert = false
    submit.disabled = false
    submit.textContent = 'Send for review'
  }
})
