import { parseLenient, canonicalContentBytes, compute, isSupported, IcfMetadata } from 'icf.js'

/**
 * Returns `text` with its `@checksum` directive set to a freshly-computed hash
 * over the canonical content (spec §19: the `@schema`/`@masters`/`@data`
 * sections, excluding `@checksum`/`@modified`/`@revision`, normalized). Used on
 * save so a changed file carries a correct integrity checksum.
 *
 * Only the `@checksum` line is rewritten — the rest of the user's text is left
 * byte-for-byte intact (unlike `writeWithChecksum`, which re-serializes the
 * whole document). If the document's `@hashmethod` has no registered provider
 * (e.g. `md5` in the browser), the text is returned unchanged so saving never
 * fails.
 */
export async function withUpdatedChecksum(text: string): Promise<string> {
  const doc = parseLenient(text)
  const method = doc.getMetadata().getHashMethod() ?? IcfMetadata.DEFAULT_HASH_METHOD
  if (!isSupported(method)) return text
  const checksum = await compute(method, canonicalContentBytes(doc))
  return setChecksumDirective(text, checksum)
}

/** Replaces an existing `@checksum` line, or inserts one into the header. */
function setChecksumDirective(text: string, value: string): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)

  const existing = lines.findIndex((line) => /^@checksum(\s|$)/.test(line))
  if (existing !== -1) {
    lines[existing] = `@checksum ${value}`
    return lines.join(eol)
  }

  // Insert after the last header metadata directive — i.e. before the first
  // section marker (@metadata/@schema/@masters/@data/@record) or content line.
  let insertAt = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^@(metadata|schema|masters|data|record)(\s|$)/.test(line)) break
    if (line.startsWith('@')) insertAt = i + 1
    else if (line.trim() !== '') break
  }
  lines.splice(insertAt, 0, `@checksum ${value}`)
  return lines.join(eol)
}
