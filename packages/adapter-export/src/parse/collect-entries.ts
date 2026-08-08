import { z } from 'zod'

export const StringListDatumSchema = z.object({
  href: z.string().optional(),
  value: z.string().optional(),
  timestamp: z.number().optional(),
})

export type StringListDatum = z.infer<typeof StringListDatumSchema>

const ContainerSchema = z.object({ string_list_data: z.array(z.unknown()) })

/** Guards against pathological or hostile nesting in a file we did not produce. */
const MAX_DEPTH = 16

/**
 * Pulls every `string_list_data` entry out of a parsed export file, wherever
 * it sits in the tree.
 *
 * This is deliberately shape-driven rather than key-driven. Instagram wraps
 * these lists in version-specific keys — `relationships_following`,
 * `relationships_followers`, and an undocumented one for sent requests that
 * has changed before. Keying on those names is the single most common reason
 * tools in this category break silently after an Instagram update; keying on
 * the shape survives a rename.
 */
export function collectStringListData(root: unknown): StringListDatum[] {
  const collected: StringListDatum[] = []
  walk(root, collected, 0)
  return collected
}

function walk(node: unknown, collected: StringListDatum[], depth: number): void {
  if (depth > MAX_DEPTH || node === null || typeof node !== 'object') return

  if (Array.isArray(node)) {
    for (const child of node) walk(child, collected, depth + 1)
    return
  }

  const container = ContainerSchema.safeParse(node)
  if (container.success) {
    // Parse entries individually: one malformed record should cost us that
    // record, not the entire file.
    for (const raw of container.data.string_list_data) {
      const datum = StringListDatumSchema.safeParse(raw)
      if (datum.success) collected.push(datum.data)
    }
    return
  }

  for (const value of Object.values(node)) walk(value, collected, depth + 1)
}
