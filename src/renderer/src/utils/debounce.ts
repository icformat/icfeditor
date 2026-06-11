/** Trailing-edge debounce. Returns a function with a `.cancel()` escape hatch. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs: number
): ((...args: A) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  const debounced = (...args: A) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, delayMs)
  }
  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  return debounced
}
