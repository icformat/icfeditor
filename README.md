# ICF Editor

A cross-platform desktop editor for the **Indent Comma Format (ICF)** and its companion index
format **ICX**, built with **TypeScript · React · Electron · Monaco Editor · Tailwind CSS**.

> Format parsing, writing, validation, and ICX generation are provided by the
> [`icf.js`](../icf.js) library. The editor consumes it through a service layer and never
> reimplements the format. See [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) for the
> full architecture and roadmap.

## Status

**Phases 0–4 are complete.** A runnable Electron app with a VS Code-like layout, the
parser/writer/validator/ICX services wired to `icf.js`, live (debounced) parse + validation,
structured record editing, the Merge / Split / Export / Go To / About dialogs, ICX regeneration,
the ICX compare view, multi-mode search, statistics, the schema filter, bookmarks / autosave /
recent-files, a **virtualized** tree for 100k+ records, a tree-shaken Monaco bundle, an
accessibility pass, and CI. Remaining polish (i18n, a parse Web Worker, signed installers) is
noted in the plan but not required for the feature set.

## Requirements

- Node ≥ 20 (developed on Node 24)
- Format parsing/validation/ICX generation come from the [`icf.js`](https://www.npmjs.com/package/icf.js)
  npm package (a normal dependency — `npm install` pulls it in).

## Getting started

```bash
npm install          # installs dependencies, incl. icf.js from npm
npm run dev          # launch Electron with HMR
```

Other scripts:

```bash
npm run typecheck    # tsc strict, node + web projects
npm test             # vitest unit tests
npm run build        # typecheck + production build to out/
npm run package      # build installers for the current OS (electron-builder)
npm run package:win  # | :mac | :linux
npm run icons        # regenerate build/icon.png + build/icon.ico from the logo SVG
```

The app icon is rendered from `src/renderer/src/assets/editor-logo.svg` into `build/icon.png`
(1024²) and `build/icon.ico` by `npm run icons` (pure JS — `@resvg/resvg-js` + `png-to-ico`); the
`package` scripts run it first, and `electron-builder` picks the icons up from `build/`.

> **Packaging on Windows:** electron-builder extracts a code-signing toolchain that contains
> symlinks; creating them requires **Developer Mode** (or an elevated shell). CI packages on
> Linux/macOS runners where this is a non-issue. `npm run build` (the app bundles) has no such
> requirement.

CI (`.github/workflows/ci.yml`) runs typecheck + tests + build on a Windows/macOS/Linux matrix;
tagged `v*` pushes additionally package installers on each OS and **attach them to the GitHub
Release** for that tag.

### Releases

Installers are **not** committed to the repository — they are produced per-OS by CI. macOS and
Linux builds cannot be cross-compiled from Windows, so the recommended way to cut a release is to
push a tag and let GitHub Actions build all three platforms on their native runners:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

Builds are **unsigned** by default. The release job publishes a `SHA256SUMS.txt` alongside the
installers so downloads can be verified (`sha256sum -c SHA256SUMS.txt`, or `Get-FileHash` on
Windows), and the GitHub Release notes spell out the per-OS install steps below.

Because the installers aren't code-signed, the OS shows a one-time trust prompt:

- **Windows** — Defender SmartScreen may show *"Windows protected your PC"*. Click
  **More info → Run anyway**. This is expected for unsigned apps and does not indicate a problem;
  it disappears once the app is installed via a trusted (CA-issued) signing certificate.
- **macOS** — the build isn't notarized, so Gatekeeper blocks a double-click. Right-click the app
  → **Open**, then confirm once.

macOS code-signing + notarization turn on automatically when the signing secrets are present in the
environment — add the repository secrets `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`, and `electron-builder.config.cjs` enables
`hardenedRuntime` + `notarize` on its own. Windows signing can be added later with a CA-issued
(OV/EV) certificate — self-signing does **not** help, as it earns no SmartScreen reputation.

## Project layout

```
src/
  main/        Electron main process — window, app menu, IPC, filesystem
  preload/     contextBridge API (window.api); contextIsolation on, nodeIntegration off
  renderer/
    src/
      components/   EditorPane (Monaco), Toolbar, TabBar, StatusBar, icons, ICF language
      panels/       Tree, Properties, Validation, Search, Statistics, Tips
      dialogs/      Merge / Split / Export / GoTo / About (+ modal shell)
      services/     12 services + DI container — the only place that imports icf.js
      models/       App + view types
      stores/       zustand view-models (document, ui)
      commands/     Keyboard-shortcut registry
      hooks/        useTheme, useAppCommands
      utils/        debounce, formatting, ids
      validators/   buildTree (folds validation status into the outline)
  shared/      IPC contracts shared by main + renderer
tests/         Vitest unit tests + fixtures
```

## How it works

Monaco holds the document **text** as the single source of truth. On every (debounced) change
the document store re-parses with `icf.js` (`parseLenient`), validates, and rebuilds a derived
index + outline. The tree, properties, validation, search, and statistics panels are all
**projections** of that model; clicking any of them reveals the corresponding line in Monaco.
Validation diagnostics are pushed back into Monaco as markers. This keeps the saved file exactly
what the user sees and gives a clean separation between UI and format logic.

> **Note on navigation:** record navigation (next/prev, Explorer clicks, Go To) is always driven
> by this **live-parsed** index, never by an ICX — so it stays correct even mid-edit, when an
> ICX's offsets would be stale. The editor *produces and verifies* ICX files (see below); it does
> not rely on them to move around.

## When to use ICX

ICX is the companion **index** for an ICF file: a machine-oriented table-of-contents holding each
record's line, byte offset, size, and checksum, plus master positions, UUIDs, `@count`, and
`@revision`. Think of it as the footer/index in Parquet or the index pages in SQLite — a
verifiable, randomly-addressable sidecar for an otherwise sequential text file.

Its value shows up in **machine-to-machine, read-mostly** scenarios — not in interactive editing:

- **Cross-system data interchange.** When one application exports data and another imports it, the
  exporter writes the ICX *atomically with* the ICF, so the index is always current (the staleness
  that makes the editor avoid ICX during live edits simply never arises). The importer can then:
  - **verify before trusting** — check `@count` + the whole-file `@checksum`, then per-record
    checksums; a mismatch pinpoints *which* record is corrupt rather than failing the whole batch;
  - **load selectively / stream** — seek straight to a record via its offset+size (including HTTP
    Range reads against a file on a CDN/object store) without parsing the whole file;
  - **cross-reference stably** — UUIDs give durable identity across systems that don't share keys.
- **Integrity & archival.** Per-record checksums detect corruption or tampering at record
  granularity for stored or transmitted data.
- **Cheap metadata & change detection.** Count, revision, and checksums answer "how big? what
  revision? what changed since last time?" from the index alone, enabling incremental sync.

In all of these the ICX is a **contract between producers and consumers of ICF**. The editor's
role is the supporting one: **regenerate** a correct index (F5), **compare** a stored ICX against
its ICF (the ICX Compare panel flags missing / stale / changed records), and **export** one on
demand — i.e. authoring and QA for the index that downstream systems consume.

## Features

- VS Code-like shell: toolbar, tabs, tree explorer, Monaco editor, tabbed bottom panel, status bar
- ICF syntax highlighting + light/dark Monaco themes; Light / Dark / System app theme
- Live parse + validation with click-to-jump problems
- Document outline with per-record warning/error badges
- Record navigation: click, Shift+wheel (record-wise), F7/F8, Go To
- Field hover (View mode): hovering a record value shows its schema key (e.g. `InvoiceNo`);
  hovering a master id or `Type:Id` reference shows the full master record as a key/value table
  (Monaco hover provider; disabled in Edit mode)
- **Structured record editing** (Edit mode): insert / duplicate / clone / delete / move up/down,
  as whole-block text edits captured by Monaco's undo
- **Merge** dialog: combine compatible files with master dedupe + conflict preview
- **Split** dialog: by record count / range / schema / max size, written to disk
- **Export** dialog: ICF / ICX / JSON (pretty+compact) / CSV / XML / YAML with live preview
- **ICX regeneration** (F5) / **ICX export**: generates a fully-populated index — `Line`, `Offset`,
  `Size`, and `Checksum` for both records and masters, record `UUID` from the `@record` attribute,
  and master `UUID` copied from a master field named `uuid` (case-insensitive) when present. (The
  `icf.js` library supplies record positions and all checksums; the editor adds the master
  positions and master UUID, which the library does not compute.)
- **ICX Compare** panel: pairs an ICF with its stored ICX (auto-detected via `@index`/`@source`,
  or loaded from disk) and reports revision/count/checksum agreement plus a per-record table
  flagging missing, stale, and changed indexes
- Search across text / record id / uuid / schema
- **Schema filter**: toggle chips in the Explorer scope the record list to chosen schemas
  (multi-select); the status bar shows the visible/total count
- **Bookmarks**: toggle (Ctrl+B), jump to next (Ctrl+Shift+B), and clear — shown as Monaco
  gutter glyphs, kept per open document
- **Autosave**: opt-in periodic save of dirty, already-saved documents (status-bar / menu toggle)
- **Recent files**: dynamic Open Recent menu, persisted across sessions
- **Session restore**: the open files, tab order, active tab, and per-file caret position are
  remembered on exit and reopened on next launch (missing files are skipped). **Untitled buffers**
  (and generated/imported in-memory tabs) are persisted to a temp folder and restored too, so the
  window can close without prompting for them
- **Import** (File ▸ Import…): converts XML / JSON / YAML / CSV to ICF. Records are flattened
  (nested objects → dotted keys, arrays → JSON), the schema is the **union of all keys** across
  the data, and each record fills an empty value where it lacks a key
- **Save All** (Ctrl+Alt+S): saves every open tab, prompting a name for untitled files
- **Checksum on save**: saving recomputes `@checksum` over the canonical content (spec §19),
  rewriting only that directive line so the rest of the file is left intact
- **External change detection**: activating a tab re-checks the file on disk (via its mtime/size
  signature) — if it was modified outside the editor it offers to reload, and if deleted it offers
  to remove the tab from the workspace
- **Unsaved-changes guard**: closing a dirty tab — or the window — prompts Save / Don't Save / Cancel
- **Format on open**: each section directive (`@metadata`/`@schema`/`@masters`/`@data`/`@record`)
  gets one blank line above it (metadata directives stay tight), and unindented content lines get a
  two-space indent — but the indent pass is **guarded**: it is skipped if it would introduce
  structural errors, so well-formed files (whose node names legitimately sit at column 0) are left
  intact and exports stay correct. Both passes preserve verbatim text blocks and report in Problems.
- Statistics (counts, file size, record-size distribution, records-per-schema)
- **Performance**: debounced background parse/validate off the keystroke path; a virtualized tree
  that scales to 100k+ records; a tree-shaken Monaco bundle (no unused language grammars)
- **Accessibility**: ARIA roles/labels on the toolbar, tablists, and tree; visible keyboard focus
- Unit tests for parser, statistics, search, split, merge, export, record editing, ICX compare,
  schema filtering, bookmarks, the virtualization flattener, guarded open-time normalization
  (indent + directive spacing), and the editor change-commit guard (53 tests)

## License

MIT © 2026 Edison Williams. The ICF and ICX specifications are © 2026 Edison Williams (CC BY 4.0).
