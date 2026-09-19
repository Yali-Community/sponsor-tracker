export const avatarOptions = ['heart', 'sparkles', 'flower', 'sun', 'leaf', 'cat'] as const
export function avatarIconUrl(value: unknown) {
  return typeof value === 'string' && (avatarOptions as readonly string[]).includes(value) ? `/avatars/${value}.svg` : ''
}
