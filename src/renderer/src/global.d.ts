import type { IpcApi } from '@shared/ipc'

declare global {
  interface Window {
    /** Privileged bridge exposed by the preload script. */
    api: IpcApi
  }
}

export {}
