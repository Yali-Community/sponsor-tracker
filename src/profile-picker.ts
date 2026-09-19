import { avatarOptions, avatarIconUrl } from './avatar-options'

export function profilePicker(form: HTMLFormElement) {
  const photo = form.elements.namedItem('photo') as HTMLInputElement
  const icon = form.elements.namedItem('avatar_icon') as HTMLInputElement
  const name = form.elements.namedItem('name') as HTMLInputElement
  const username = form.elements.namedItem('user_id') as HTMLInputElement
  const preview = document.querySelector<HTMLImageElement>('#profile-preview-image')!
  const feedback = document.querySelector('#photo-feedback')!
  const remove = document.querySelector<HTMLButtonElement>('#remove-profile-photo')!
  const choices = document.querySelector('#avatar-choices')!
  let photoUrl = ''
  const buttons = avatarOptions.map(option => {
    const button = document.createElement('button')
    button.type = 'button'; button.setAttribute('aria-label', `${option[0].toUpperCase() + option.slice(1)} icon`)
    const image = document.createElement('img')
    image.src = avatarIconUrl(option); image.alt = ''; image.width = 42; image.height = 42
    button.append(image)
    button.addEventListener('click', () => { icon.value = option; photo.value = ''; update() })
    choices.append(button)
    return button
  })
  function update() {
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    photoUrl = ''
    photo.setCustomValidity('')
    const file = photo.files?.[0]
    const invalid = file && (file.size > 1024 * 1024 || !['image/png', 'image/jpeg'].includes(file.type))
    if (invalid) photo.setCustomValidity('Choose a PNG or JPEG photo under 1 MB.')
    if (file && !invalid) photoUrl = URL.createObjectURL(file)
    preview.src = photoUrl || avatarIconUrl(icon.value)
    preview.alt = photoUrl ? 'Your uploaded profile photo preview' : `Selected ${icon.value} profile icon`
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(!photoUrl && icon.value === avatarOptions[index])))
    remove.hidden = !file
    feedback.textContent = invalid ? 'Choose a PNG or JPEG photo under 1 MB, or pick an icon above.' : file ? `${file.name} · photo selected. It will appear after approval.` : 'No photo needed. Your selected icon will appear after approval.'
    feedback.classList.toggle('photo-error', Boolean(invalid))
  }
  photo.addEventListener('change', update)
  preview.addEventListener('error', () => {
    if (!photoUrl) return
    URL.revokeObjectURL(photoUrl); photoUrl = ''
    photo.setCustomValidity('This photo could not be opened. Choose another photo or an icon.')
    preview.src = avatarIconUrl(icon.value)
    feedback.textContent = 'This photo could not be opened. Choose another photo or an icon.'
    feedback.classList.add('photo-error')
  })
  remove.addEventListener('click', () => { photo.value = ''; update() })
  function identity() {
    document.querySelector('#profile-preview-name')!.textContent = name.value.trim() || 'Your name'
    document.querySelector('#profile-preview-handle')!.textContent = '@' + (username.value.trim().toLowerCase() || 'yourname')
  }
  name.addEventListener('input', identity); username.addEventListener('input', identity)
  update(); identity()
  return { reset() { update(); identity() } }
}
