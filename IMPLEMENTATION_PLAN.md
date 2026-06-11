# ICF Editor — Implementation Plan

A cross-platform desktop editor for the **Indent Comma Format (ICF)** and its companion
index format **ICX**, built with **TypeScript, React, Electron, Monaco Editor, and Tailwind CSS**.

This document is the engineering plan that the scaffold in this repository realizes. It
records the decisions, the architecture, how the existing `icf.js` library is consumed, and
the phased roadmap from scaffold to shippable app.

---

## 1. Guiding decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Format logic** | Consume `icf.js` (sibling repo `../icf.js`) — do **not** reimplement | It is a complete, tested ICF/ICX parser, writer, validator, ICX generator, and checksum engine with a documented public API and full round-trip fidelity. Reimplementing would duplicate logic and drift from the spec. |
| **Build tool** | `electron-vite` | First-class Electron main/preload/renderer separation, fast HMR, esbuild/rollup under the hood, native TypeScript. |
| **UI state** | `zustand` | Minimal boilerplate, no context-provider tree, selector-based re-renders — fits MVVM view-models cleanly. |
| **Editor surface** | `monaco-editor` via `@monaco-editor/react` | The brief requires a VS Code-like experience; Monaco gives us a real text buffer, find/replace, folding, and a custom ICF language definition. |
| **Styling / theming** | Tailwind CSS with `class`-based dark mode + CSS variables | Light / Dark / System themes by toggling a root class; design tokens as CSS variables so Monaco and Tailwind share one palette. |
| **Virtualization** | `@tanstack/react-virtual` | The brief requires 100,000+ records; only mount visible tree/record rows. |
| **Tests** | `vitest` | Same runner as `icf.js`; fast, ESM-native, jsdom/happy-dom for component tests. |
| **Packaging** | `electron-builder` | Windows (NSIS), macOS (dmg), Linux (AppImage/deb) installers from one config. |

### Why a hybrid "Monaco text + structured panels" model

ICF is a **text format**, and power users will want to edit the raw bytes. But the brief also
demands structured navigation (tree, record viewer, collapsible sections, properties). Rather
than choose, the editor keeps **Monaco as the source of truth for the document text** and
derives a parsed `IcfDocument` model from it on every (debounced) change. Structured panels are
**projections** of that model; structured edits (insert/delete/move record, edit a field) are
applied as **text edits** back into Monaco. This keeps a single source of truth, guarantees the
saved file is exactly what the user sees, and gives undo/redo for free via Monaco's edit stack
(augmented by an app-level `UndoService` for structural operations).

---

## 2. Architecture (MVVM)

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer (React + Monaco)                                   │
│                                                              │
│  Views (components/, panels/, dialogs/)                      │
│        │  observe                ▲  intent (commands)        │
│        ▼                         │                           │
│  View-Models (zustand stores: document, ui, settings)       │
│        │  call                   ▲  results                  │
│        ▼                         │                           │
│  Services (DI container)         │                           │
│   ICFParser  ICFWriter  ICFValidator  ICXGenerator  ICXParser│
│   Search  Merge  Split  Statistics  Export  Undo  Settings   │
│        │                                                     │
│        ▼  (all format logic delegates to)                    │
│  ┌──────────────┐                                            │
│  │   icf.js     │  parse / write / validate / generateIcx    │
│  └──────────────┘                                            │
│        │ IPC (preload contextBridge)                         │
└────────┼─────────────────────────────────────────────────────┘
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Main process: file open/save dialogs, fs read/write,        │
│  recent files, window/menu, OS integration                   │
└─────────────────────────────────────────────────────────────┘
```

**Layer rules**

- Views never import `icf.js` directly — only services do. (Keeps UI and parser logic separate.)
- Services are plain classes resolved through a tiny DI container (`services/container.ts`),
  so they can be swapped/mocked in tests.
- The main process owns the filesystem; the renderer reaches it through a typed `window.api`
  bridge exposed by the preload script. `nodeIntegration` is **off**, `contextIsolation` is **on**.

### Directory layout (as specified in `Prompt.md`)

```
src/
  main/                 Electron main process (window, menu, IPC, fs)
  preload/              contextBridge API surface
  renderer/
    src/
      components/       Reusable presentational widgets
      panels/           Tree, Properties, Validation, Search, Statistics, Tips
      dialogs/          Merge, Split, Export, GoTo, About
      services/         The 12 services + DI container (wrap icf.js)
      models/           TS types/interfaces for app + view state
      commands/         Command objects + keyboard-shortcut registry
      hooks/            React hooks (useDocument, useTheme, useShortcuts…)
      utils/            Pure helpers (formatting, debounce, ids)
      validators/       Editor-level validation orchestration over icf.js
      stores/           zustand view-models
  shared/               Types shared between main and renderer (IPC contracts)
tests/                  Vitest unit/integration tests + fixtures
```

---

## 3. Services — responsibilities and `icf.js` mapping

All twelve services named in `Prompt.md` exist. The format-bearing ones are **thin adapters**
over `icf.js`; the editor-specific ones are **new logic built on the `icf.js` data model**.

| Service | Backed by | Responsibility |
|---|---|---|
| `ICFParserService` | `icf.js` `parse` / `parseLenient` / `IcfParser` | Text → `IcfDocument` (+ diagnostics). Lenient parse for the live editor so a half-typed file still renders. |
| `ICFWriterService` | `icf.js` `write` / `writeWithChecksum` / `IcfWriter` | Model → ICF text; canonical record/master body text for diffing. |
| `ICFValidatorService` | `icf.js` `validate` / `IcfValidator` | Full diagnostic list with line numbers, mapped to the validation panel. Covers schema, field count, references, masters, duplicate id/uuid, directives, indentation, text blocks (all native to `icf.js`). |
| `ICXGeneratorService` | `icf.js` `generateIcx` / `generateIcxWithChecksums` | Build ICX `IcfDocument`; compare vs. stored ICX (revision, sourcerevision, checksums, counts). |
| `ICXParserService` | `icf.js` `parse` (an ICX is an ICF document) | Load `.icx`, expose index rows for the compare view. |
| `SearchService` | `icf.js` model + own index | Text / record-id / uuid / schema / full-text search; returns hits with line ranges for Monaco decorations. |
| `MergeService` | `icf.js` model | Merge N compatible documents (metadata, schemas, masters w/ dedupe, records); conflict detection; preview. |
| `SplitService` | `icf.js` model + writer | Split by record range, schema, record count, or max file size. |
| `StatisticsService` | `icf.js` model | Counts (schemas/masters/records), file size, record-size distribution, revision, dates. |
| `ExportService` | `icf.js` `toIcfNode()` JSON tree | Export to ICF, ICX, JSON (pretty/compact), CSV, XML, YAML. |
| `UndoService` | app-level | Command stack for structural edits that complements Monaco's text undo. |
| `SettingsService` | `electron-store` via IPC | Persist theme, recent files, panel layout, autosave, bookmarks. |

**Checksum note:** `icf.js` checksums are async (Web Crypto). `writeWithChecksum`,
`generateIcxWithChecksums`, and `Checksums.compute` all return Promises — services expose async
methods accordingly. The invariant the editor surfaces in the compare view is
*ICF `@checksum` == ICX `@sourcechecksum`*.

---

## 4. Feature → layer map (from `Prompt.md`)

| Brief feature | Where it lives |
|---|---|
| View / Edit modes | `stores/uiStore` mode flag; Monaco `readOnly` toggle; panels switch affordances |
| Collapsible sections (metadata/schema/masters/data/record) | `panels/TreePanel` + Monaco folding ranges derived from the parsed model; collapse state in `uiStore`, persisted per open file |
| Record-wise scrolling, Shift+wheel, Ctrl+Up/Down, Go To | `hooks/useRecordNavigation` mapping record start lines → `editor.revealLineNearTop` |
| Tree view with icons + warning/error badges | `panels/TreePanel`, virtualized; badges from `ICFValidatorService` results |
| Search (text/id/uuid/schema/full-text) | `panels/SearchPanel` + `SearchService`; Monaco decorations for highlights |
| Record filters by schema (multi-select) | `SearchService.filterBySchemas`; tree + record list honor the filter |
| Record information panel | `panels/PropertiesPanel` reads `IcfRecord` attributes + validation status |
| Validation panel, click-to-jump | `panels/ValidationPanel`; each message carries a line → `editor.revealLine` |
| ICX generate / view / regenerate / compare | `dialogs` + `ICXGeneratorService` + `ICXParserService`; F5 regenerates |
| Merge / Split | `dialogs/MergeDialog`, `dialogs/SplitDialog` + services, with preview |
| Export (ICF/ICX/JSON/CSV/XML/YAML) | `dialogs/ExportDialog` + `ExportService` |
| Statistics | `panels/StatisticsPanel` + `StatisticsService` |
| Tips panel | `panels/TipsPanel` (shortcuts, examples, best practices, recent ops) |
| Editor ops (cut/copy/paste/duplicate/insert/clone/move/bookmarks/recent/autosave) | `commands/` registry + `UndoService` + `SettingsService` |
| Keyboard shortcuts | `commands/shortcuts.ts` central map; `hooks/useShortcuts` |
| Themes (light/dark/system) | `hooks/useTheme`, Tailwind `class` strategy, Monaco theme sync |
| Help / About | `dialogs/AboutDialog` with spec + tool links |
| Performance (100k+ records, lazy load, virtual scroll, background validation) | virtualized tree/list; validation + parse run debounced in an idle callback / worker |

---

## 5. Performance strategy

- **Single parse per change, debounced** (~150 ms idle) — `parseLenient` so partial input renders.
- **Virtualized** tree and record list (`@tanstack/react-virtual`); only visible rows mount.
- **Background validation** off the keystroke path; results applied as Monaco decorations + tree badges.
- **Line index**: after each parse, build a `recordId → startLine` and `schema → records` index
  once, reused by navigation, search, and filters.
- For very large files, structured panels page the record list; Monaco itself streams the text.
- A later optimization (Phase 4) moves parse/validate into a Web Worker if main-thread time grows.

---

## 6. Phased roadmap

| Phase | Scope | Status in this repo |
|---|---|---|
| **0 — Scaffold** | Toolchain, Electron shell, DI, service stubs wrapping `icf.js`, UI layout shell, theming, a few real services + tests | **Delivered** |
| **1 — Core editing** | Live parse↔text sync, tree/properties/validation panels wired, record navigation, View/Edit modes, open/save, **structured record editing**, **Merge/Split/Export/GoTo/About dialogs**, **ICX regenerate→tab** | **Delivered** |
| **2 — ICX + search** | ICX compare view (stale/missing/changed index), all search modes, schema filter UI, statistics | **Delivered** |
| **3 — Transforms** | Bookmarks, autosave, recent-files menu (Merge/Split/Export already delivered in Phase 1) | **Delivered** |
| **4 — Hardening** | Virtualization at 100k+, debounced background validation, accessibility (ARIA/focus), Monaco tree-shake, packaging config, CI | **Delivered** (i18n, a dedicated parse Web Worker, and signed installers remain optional polish) |

Effort: Phase 1 and 4 are the largest; Phase 0 (this scaffold) establishes every seam so the
remaining phases are additive, not structural.

---

## 7. Testing strategy

- **Service unit tests** (Vitest): parser adapter, statistics, search, split, merge, export —
  using small fixtures in `tests/fixtures/`. The `parse → transform → write → parse` round trip
  is the strongest correctness check (mirrors `icf.js`'s own test philosophy).
- **Validator tests**: feed known-bad ICF and assert the expected diagnostic codes/lines.
- **Component tests**: tree rendering, validation-panel jump, theme toggle (happy-dom).
- **CI** (Phase 4): GitHub Actions matrix (Windows/macOS/Linux) running `typecheck` + `test`,
  then `electron-builder` on tagged releases.

---

## 8. Dependency on `icf.js`

The scaffold references the sibling library by relative path:

```json
"dependencies": { "icf.js": "file:../icf.js" }
```

`../icf.js/dist` is already built (ESM + `index.d.ts`), so types and runtime resolve without a
publish step. If the library is later published to npm, only the version specifier changes; no
service code changes, because all format access is funnelled through the service adapters.
