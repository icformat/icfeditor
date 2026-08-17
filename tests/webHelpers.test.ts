import { describe, it, expect } from 'vitest'
import { uniqueName } from '@renderer/web/pathNames'
import { commandForKey, type KeyLike } from '@renderer/web/webShortcuts'

describe('uniqueName', () => {
  it('keeps an unused name unchanged', () => {
    expect(uniqueName(['a.icf'], 'b.icf')).toBe('b.icf')
  })

  it('numbers collisions before the extension', () => {
    expect(uniqueName(['invoice.icf'], 'invoice.icf')).toBe('invoice (2).icf')
    expect(uniqueName(['invoice.icf', 'invoice (2).icf'], 'invoice.icf')).toBe('invoice (3).icf')
  })

  it('handles names without an extension', () => {
    expect(uniqueName(['notes'], 'notes')).toBe('notes (2)')
  })
})

function key(partial: Partial<KeyLike> & { key: string }): KeyLike {
  return { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...partial }
}

describe('commandForKey', () => {
  it('maps the accelerators the native menu owned', () => {
    expect(commandForKey(key({ key: 's', ctrlKey: true }))).toBe('file.save')
    expect(commandForKey(key({ key: 'S', ctrlKey: true, shiftKey: true }))).toBe('file.saveAs')
    expect(commandForKey(key({ key: 's', ctrlKey: true, altKey: true }))).toBe('file.saveAll')
    expect(commandForKey(key({ key: 'o', ctrlKey: true }))).toBe('file.open')
    expect(commandForKey(key({ key: 'f', ctrlKey: true }))).toBe('edit.find')
    expect(commandForKey(key({ key: 'g', ctrlKey: true }))).toBe('record.goto')
    expect(commandForKey(key({ key: 'b', ctrlKey: true, shiftKey: true }))).toBe('edit.nextBookmark')
    expect(commandForKey(key({ key: 'F5' }))).toBe('icx.regenerate')
    expect(commandForKey(key({ key: 'F6' }))).toBe('doc.validate')
    expect(commandForKey(key({ key: 'Enter', altKey: true }))).toBe('file.properties')
  })

  it('supports the macOS command key', () => {
    expect(commandForKey(key({ key: 's', metaKey: true }))).toBe('file.save')
  })

  it('leaves browser/Monaco keys alone', () => {
    expect(commandForKey(key({ key: 's' }))).toBeNull() // plain typing
    expect(commandForKey(key({ key: 'z', ctrlKey: true }))).toBeNull() // Monaco undo
    expect(commandForKey(key({ key: 'c', ctrlKey: true }))).toBeNull() // clipboard
    expect(commandForKey(key({ key: 'F5', shiftKey: true }))).toBeNull()
    expect(commandForKey(key({ key: 'n', ctrlKey: true }))).toBeNull() // reserved by Chromium
  })
})
