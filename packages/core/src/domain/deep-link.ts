export interface ProfileLinks {
  /**
   * Native app scheme. Opens the profile directly in the Instagram app, where
   * the "Requested" button is one tap from cancelling.
   *
   * NOTE: this scheme is undocumented by Meta and sources disagree on
   * `user` vs `profile`. Always offer {@link ProfileLinks.web} as a fallback,
   * and verify on a real device before shipping a mobile build.
   */
  readonly app: string
  /** Universal link. Works everywhere, and defers to the app when installed. */
  readonly web: string
}

export function buildProfileLinks(username: string): ProfileLinks {
  const handle = encodeURIComponent(username.trim().replace(/^@/, ''))
  return {
    app: `instagram://user?username=${handle}`,
    web: `https://www.instagram.com/${handle}/`,
  }
}
