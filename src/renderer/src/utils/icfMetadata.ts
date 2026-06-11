import { IcfMetadata } from 'icf.js'

/**
 * Clones an {@link IcfMetadata} and overrides `@records` with `count`.
 *
 * Split parts and merge results carry a different number of records than the
 * source, but they reuse the source metadata — which holds the *original*
 * explicit `@records`. The writer emits an explicit `@records` verbatim (it
 * only auto-computes when none is present), so without this the output would
 * report the wrong count. Cloning (rather than mutating) avoids corrupting the
 * source document's metadata, which is shared across split parts.
 *
 * Both standard directives and the user `@metadata` section are copied in order.
 */
export function cloneMetadataWithRecordCount(source: IcfMetadata, count: number): IcfMetadata {
  const clone = new IcfMetadata()
  for (const [name, value] of source.asMap()) clone.put(name, value)
  for (const [name, value] of source.userMetadataAsMap()) clone.putUserMetadata(name, value)
  clone.put('records', String(count))
  return clone
}

/**
 * Increments `@revision` in place. The revision should increase whenever the
 * records change (spec §19), so split and merge — which produce new content —
 * bump it. A missing or non-positive value becomes `1` (the first revision).
 */
export function bumpRevision(metadata: IcfMetadata): void {
  const current = Number.parseInt(metadata.get('revision') ?? '', 10)
  const next = Number.isFinite(current) && current > 0 ? current + 1 : 1
  metadata.put('revision', String(next))
}
