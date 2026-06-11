let counter = 0

/** Monotonic, collision-free id for open documents and tree nodes. */
export function nextId(prefix = 'id'): string {
  counter += 1
  return `${prefix}-${counter}`
}
