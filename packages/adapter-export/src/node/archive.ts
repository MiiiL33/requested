import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { unzip } from 'fflate'
import { ExportNotFoundError, MalformedExportError } from '../errors.js'

/**
 * A read-only view over an export, whether it arrived as a .zip or as an
 * already-unzipped folder.
 *
 * The interface is deliberately narrow — "give me the files named X" rather
 * than "list everything" — because a full export can be gigabytes of photos,
 * and we only ever need two small JSON files. For ZIPs this means fflate
 * decompresses only the matching entries.
 */
export interface Archive {
  extract(basenames: ReadonlySet<string>): Promise<Map<string, string>>
}

export async function openArchive(path: string): Promise<Archive> {
  let info
  try {
    info = await stat(path)
  } catch {
    throw new ExportNotFoundError(path)
  }

  return info.isDirectory() ? new DirectoryArchive(path) : new ZipArchive(path)
}

class DirectoryArchive implements Archive {
  constructor(private readonly root: string) {}

  async extract(basenames: ReadonlySet<string>): Promise<Map<string, string>> {
    const entries = await readdir(this.root, { recursive: true })
    const found = new Map<string, string>()

    for (const entry of entries) {
      const name = basename(entry).toLowerCase()
      if (!basenames.has(name) || found.has(name)) continue

      try {
        found.set(name, await readFile(join(this.root, entry), 'utf8'))
      } catch {
        // A directory that happens to share the name, or an unreadable file.
        continue
      }
    }

    return found
  }
}

class ZipArchive implements Archive {
  constructor(private readonly path: string) {}

  async extract(basenames: ReadonlySet<string>): Promise<Map<string, string>> {
    const buffer = await readFile(this.path)

    const unzipped = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      unzip(
        new Uint8Array(buffer),
        { filter: (file) => basenames.has(basename(file.name).toLowerCase()) },
        (error, data) => {
          if (error) reject(new MalformedExportError(this.path, error.message))
          else resolve(data)
        },
      )
    })

    const decoder = new TextDecoder()
    const found = new Map<string, string>()

    for (const [path, bytes] of Object.entries(unzipped)) {
      const name = basename(path).toLowerCase()
      if (found.has(name)) continue
      found.set(name, decoder.decode(bytes))
    }

    return found
  }
}
