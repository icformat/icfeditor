/** A reversible structural operation (insert/delete/move/clone record, etc.). */
export interface UndoableCommand {
  label: string
  do(): void
  undo(): void
}

/**
 * App-level undo stack for *structural* edits that happen outside Monaco's text
 * buffer (e.g. reordering records via the tree). Plain text edits rely on
 * Monaco's own undo; this stack composes with it at the command layer.
 */
export class UndoService {
  private readonly undoStack: UndoableCommand[] = []
  private readonly redoStack: UndoableCommand[] = []

  /** Runs a command and pushes it onto the undo stack. */
  execute(command: UndoableCommand): void {
    command.do()
    this.undoStack.push(command)
    this.redoStack.length = 0
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  undo(): void {
    const command = this.undoStack.pop()
    if (!command) return
    command.undo()
    this.redoStack.push(command)
  }

  redo(): void {
    const command = this.redoStack.pop()
    if (!command) return
    command.do()
    this.undoStack.push(command)
  }

  clear(): void {
    this.undoStack.length = 0
    this.redoStack.length = 0
  }
}
