import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Reads a fixture file from tests/fixtures by name. Resolves from the project
 * working directory (vitest runs with cwd at the project root) rather than
 * import.meta.url, which is unreliable under the happy-dom environment.
 */
export function fixture(name: string): string {
  return readFileSync(resolve(process.cwd(), 'tests', 'fixtures', name), 'utf-8')
}
