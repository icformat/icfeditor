import { useCallback, useRef } from 'react'

interface SplitterProps {
  /** 'x' resizes a width (vertical divider); 'y' resizes a height (horizontal divider). */
  axis: 'x' | 'y'
  /** Current size in px of the pane this splitter resizes. */
  value: number
  min: number
  max: number
  /**
   * When the handle sits on the top/left edge of the resized pane, dragging
   * toward smaller screen coordinates should *grow* the pane — set invert.
   */
  invert?: boolean
  onChange: (next: number) => void
  ariaLabel: string
}

/**
 * A thin draggable divider. Uses pointer capture so the drag keeps tracking
 * even while the cursor passes over the Monaco editor. The size is computed
 * absolutely from the pointer-down baseline, so it never drifts at the clamps.
 */
export function Splitter({ axis, value, min, max, invert, onChange, ariaLabel }: SplitterProps) {
  const drag = useRef<{ start: number; base: number } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { start: axis === 'x' ? e.clientX : e.clientY, base: value }
    },
    [axis, value]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d) return
      const pos = axis === 'x' ? e.clientX : e.clientY
      const delta = pos - d.start
      const next = d.base + (invert ? -delta : delta)
      onChange(Math.max(min, Math.min(max, next)))
    },
    [axis, invert, min, max, onChange]
  )

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  const isX = axis === 'x'
  return (
    <div
      role="separator"
      aria-orientation={isX ? 'vertical' : 'horizontal'}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={
        'shrink-0 bg-app-border transition-colors hover:bg-app-accent/60 active:bg-app-accent ' +
        (isX ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize')
      }
    />
  )
}
