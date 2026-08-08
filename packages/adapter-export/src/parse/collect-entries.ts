import { z } from 'zod'

/**
 * One relationship record, normalised away from whichever export format it
 * came from. Every field is optional because real exports omit all of them
 * in some combination.
 */
export interface RawRelationship {
  readonly username?: string
  readonly href?: string
  readonly timestamp?: number
}

/** Guards against pathological or hostile nesting in a file we did not produce. */
const MAX_DEPTH = 16

// ---------------------------------------------------------------------------
// Format A — `string_list_data`. Used by following.json, followers_*.json.
// ---------------------------------------------------------------------------

const StringListDatumSchema = z.object({
  href: z.string().optional(),
  value: z.string().optional(),
  timestamp: z.number().optional(),
})

const StringListContainerSchema = z.object({ string_list_data: z.array(z.unknown()) })

// ---------------------------------------------------------------------------
// Format B — `label_values`. Used by pending_follow_requests.json.
//
// Confirmed against a real August 2026 export: a bare top-level array of
// `{timestamp, media, label_values, fbid}`, where label_values carries
// `URL`, `Name` and `Username`. Note the two formats coexist *within the same
// archive*, which is why parsing has to handle both rather than pick one.
// ---------------------------------------------------------------------------

const LabelValueSchema = z.object({
  label: z.string(),
  value: z.string().optional(),
  href: z.string().optional(),
})

const LabelValuesContainerSchema = z.object({
  label_values: z.array(z.unknown()),
  timestamp: z.number().optional(),
})

/**
 * Labels are matched loosely and across languages. Meta emitted English labels
 * even for a French-locale account, but that is not guaranteed, and a missed
 * label would silently drop every record.
 */
const USERNAME_LABEL = /user\s*name|utilisateur|usuario|benutzername|nome utente/i
const URL_LABEL = /^(url|link|lien|enlace|profile)$/i

/**
 * Pulls every relationship record out of a parsed export file, wherever it
 * sits in the tree and whichever of the two formats it uses.
 *
 * Deliberately shape-driven rather than key-driven: Instagram wraps these
 * lists in version-specific keys (`relationships_following`, and an
 * undocumented one for sent requests) and has renamed them before. Keying on
 * names is the most common reason tools in this category break silently after
 * an Instagram update; keying on shape survives a rename.
 */
export function collectRelationships(root: unknown): RawRelationship[] {
  const collected: RawRelationship[] = []
  walk(root, collected, 0)
  return collected
}

function walk(node: unknown, collected: RawRelationship[], depth: number): void {
  if (depth > MAX_DEPTH || node === null || typeof node !== 'object') return

  if (Array.isArray(node)) {
    for (const child of node) walk(child, collected, depth + 1)
    return
  }

  const stringList = StringListContainerSchema.safeParse(node)
  if (stringList.success) {
    // Parse records individually: one malformed entry should cost us that
    // entry, not the whole file.
    for (const raw of stringList.data.string_list_data) {
      const datum = StringListDatumSchema.safeParse(raw)
      if (datum.success) collected.push(fromStringListDatum(datum.data))
    }
    return
  }

  const labelled = LabelValuesContainerSchema.safeParse(node)
  if (labelled.success) {
    const relationship = fromLabelValues(labelled.data)
    if (relationship !== undefined) collected.push(relationship)
    return
  }

  for (const value of Object.values(node)) walk(value, collected, depth + 1)
}

function fromStringListDatum(datum: z.infer<typeof StringListDatumSchema>): RawRelationship {
  return {
    ...maybe('username', datum.value),
    ...maybe('href', datum.href),
    ...(datum.timestamp === undefined ? {} : { timestamp: datum.timestamp }),
  }
}

function fromLabelValues(
  entry: z.infer<typeof LabelValuesContainerSchema>,
): RawRelationship | undefined {
  let username: string | undefined
  let href: string | undefined

  for (const raw of entry.label_values) {
    const parsed = LabelValueSchema.safeParse(raw)
    if (!parsed.success) continue

    // Real exports carry an empty `URL` value for most records, so blanks must
    // be treated as absent rather than as a profile link.
    const value = (parsed.data.value ?? parsed.data.href ?? '').trim()
    if (value === '') continue

    if (username === undefined && USERNAME_LABEL.test(parsed.data.label)) {
      username = value
    } else if (
      href === undefined &&
      (URL_LABEL.test(parsed.data.label) || /^https?:\/\//i.test(value))
    ) {
      href = value
    }
  }

  if (username === undefined && href === undefined) return undefined

  return {
    ...maybe('username', username),
    ...maybe('href', href),
    ...(entry.timestamp === undefined ? {} : { timestamp: entry.timestamp }),
  }
}

function maybe(key: 'username' | 'href', value: string | undefined): RawRelationship {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === '' ? {} : { [key]: trimmed }
}
