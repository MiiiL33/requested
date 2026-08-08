/**
 * Instagram usernames are case-insensitive, and the export mixes casing between
 * files. Every cross-file comparison (notably pending-vs-following reconciliation)
 * must go through this, or accepted requests leak back into the results.
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, '').replace(/\/+$/, '').toLowerCase()
}

/** Recovers a username from a profile URL, e.g. `https://instagram.com/foo/` -> `foo`. */
export function usernameFromProfileUrl(href: string): string | undefined {
  const match = /instagram\.com\/([^/?#]+)/i.exec(href)
  const captured = match?.[1]
  if (captured === undefined || captured === '') return undefined
  return normalizeUsername(decodeURIComponent(captured))
}
