import React from 'react'
import { createRoot } from 'react-dom/client'
import './components/monacoSetup'
import { createWebApi } from './web/webApi'
import { WebShell } from './web/WebShell'
import logoUrl from './assets/editor-logo.svg'
import './styles/theme.css'

/**
 * Entry point for the **web build** hosted on icformat.org. Installs the
 * browser implementation of the `window.api` bridge BEFORE the app renders —
 * the entire renderer is written against that one interface, so this is the
 * only difference from the desktop build (plus the in-app menu bar).
 */
const api = createWebApi()
window.api = api

const favicon =
  document.querySelector<HTMLLinkElement>("link[rel='icon']") ?? document.createElement('link')
favicon.rel = 'icon'
favicon.type = 'image/svg+xml'
favicon.href = logoUrl
document.head.appendChild(favicon)

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

createRoot(container).render(
  <React.StrictMode>
    <WebShell api={api} />
  </React.StrictMode>
)
