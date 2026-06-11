import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDocumentStore } from '@renderer/stores/documentStore'
import {
  restoreSession,
  persistSession,
  recordCursor,
  takePendingCursor
} from '@renderer/actions/session'
import type { SessionState } from '@renderer/models/session'

function stubApi(overrides: Record<string, unknown> = {}) {
  const setSetting = vi.fn((_key: string, _value: SessionState) => Promise.resolve())
  const writeBuffer = vi.fn((_id: string, _content: string) => Promise.resolve())
  const pruneBuffers = vi.fn((_keepIds: string[]) => Promise.resolve())
  const buffers: Record<string, string> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).api = {
    getSetting: async () => undefined,
    setSetting,
    readFile: async (p: string) => ({ path: p, content: '@kind icf\n\n@data\n', mtimeMs: 1, size: 1 }),
    addRecentFile: async () => [],
    statFile: async () => null,
    writeBuffer: (id: string, content: string) => {
      buffers[id] = content
      return writeBuffer(id, content)
    },
    readBuffer: async (id: string) => buffers[id] ?? null,
    pruneBuffers,
    ...overrides
  }
  return { setSetting, writeBuffer, pruneBuffers, buffers }
}

beforeEach(() => {
  useDocumentStore.setState({ documents: [], activeId: null, index: null, tree: [], diagnostics: [] })
})

describe('session persistence', () => {
  it('persists saved files and untitled buffers in tab order', async () => {
    const { setSetting, writeBuffer } = stubApi()
    const store = useDocumentStore.getState()
    store.openFile('a.icf', '@kind icf\n\n@data\n', { mtimeMs: 1, size: 1 })
    const bufId = store.openVirtual('draft.icf', '@kind icf\n\n@data\n', 'icf')

    await persistSession()
    const session = setSetting.mock.calls.at(-1)![1]
    expect(session.tabs.map((t) => t.path ?? t.bufferId)).toEqual(['a.icf', bufId])
    expect(session.tabs[1].path).toBeNull()
    expect(session.activeKey).toBe(bufId)
    // The untitled buffer's content was written to a temp file.
    expect(writeBuffer).toHaveBeenCalledWith(bufId, '@kind icf\n\n@data\n')
  })

  it('restores saved files and untitled buffers, and the active tab', async () => {
    const session: SessionState = {
      tabs: [
        { kind: 'icf', fileName: 'x.icf', path: 'x.icf', bufferId: null, cursor: null },
        { kind: 'icf', fileName: 'draft.icf', path: null, bufferId: 'doc-99', cursor: null }
      ],
      activeKey: 'doc-99'
    }
    stubApi({
      getSetting: async () => session,
      readBuffer: async (id: string) => (id === 'doc-99' ? '@kind icf\n\n@data\n' : null)
    })

    expect(await restoreSession()).toBe(true)
    const state = useDocumentStore.getState()
    expect(state.documents.map((d) => d.fileName)).toEqual(['x.icf', 'draft.icf'])
    expect(state.documents[1].path).toBeNull() // restored as an untitled buffer
    expect(state.documents.find((d) => d.id === state.activeId)?.fileName).toBe('draft.icf')
  })

  it('drops a buffer tab whose temp file is gone', async () => {
    stubApi({
      getSetting: async () =>
        ({
          tabs: [{ kind: 'icf', fileName: 'draft.icf', path: null, bufferId: 'doc-gone', cursor: null }],
          activeKey: null
        }) as SessionState,
      readBuffer: async () => null
    })
    await restoreSession()
    expect(useDocumentStore.getState().documents).toHaveLength(0)
  })

  it('returns a saved caret once, then defers to the editor', () => {
    recordCursor('probe-key.icf', 5, 3)
    expect(takePendingCursor('probe-key.icf')).toEqual({ line: 5, column: 3 })
    expect(takePendingCursor('probe-key.icf')).toBeNull()
  })
})
