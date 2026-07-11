import { Dialog, DialogButton } from './Dialog'
import logoUrl from '../assets/editor-logo.svg'

const LINKS = [
  { label: 'ICF 1.1 specification', url: 'https://icformat.org/icf/specification/v1.1/' },
  { label: 'ICX 1.2 specification', url: 'https://icformat.org/icx/specification/v1.2/' },
  { label: 'icformat.org', url: 'https://icformat.org' },
  { label: 'icf.js library', url: 'https://github.com/icformat/icf.js' }
]

/** About / Help dialog (Prompt.md §Help). */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      title="About ICF Editor"
      onClose={onClose}
      footer={<DialogButton onClick={onClose} variant="primary">Close</DialogButton>}
    >
      <div className="mb-3 flex items-center gap-3">
        <img src={logoUrl} alt="" className="h-10 w-10" />
        <p>
          <strong>ICF Editor</strong> — a desktop editor for the Indent Comma Format (ICF) and its
          ICX index companion.
        </p>
      </div>
      <p className="mb-3 text-app-muted">
        Built with TypeScript, React, Electron, Monaco, and Tailwind CSS. Format parsing,
        validation, and ICX generation are provided by the <code>icf.js</code> library.
      </p>
      <h3 className="mb-1 font-semibold text-app-muted">Specifications &amp; tools</h3>
      <ul className="list-disc pl-4">
        {LINKS.map((link) => (
          <li key={link.url}>
            <a className="text-app-accent" href={link.url} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-app-muted">© 2026 Edison Williams · MIT License</p>
    </Dialog>
  )
}
