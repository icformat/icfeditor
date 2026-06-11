import { useEffect, type ReactNode } from 'react'

interface DialogProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Footer buttons (right-aligned). */
  footer?: ReactNode
  width?: number
}

/**
 * Accessible modal shell: dimmed backdrop, ESC to close, click-outside to
 * close, `role="dialog"` + `aria-modal`. All editor dialogs render through this
 * so focus handling and styling stay consistent.
 */
export function Dialog({ title, onClose, children, footer, width = 520 }: DialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] flex-col rounded-lg border border-app-border bg-app-surface shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-app-border px-4 py-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded px-2 hover:bg-app-surface-hover" title="Close">
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4 text-xs">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-app-border px-4 py-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

/** Shared primary/secondary button styles for dialog footers. */
export function DialogButton({
  children,
  onClick,
  variant = 'secondary',
  disabled
}: {
  children: ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}) {
  const base = 'rounded px-3 py-1 text-xs disabled:opacity-40'
  const styles =
    variant === 'primary'
      ? 'bg-app-accent text-white hover:bg-app-accent-hover'
      : 'border border-app-border hover:bg-app-surface-hover'
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  )
}
