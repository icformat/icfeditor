import React from 'react'
import { createRoot } from 'react-dom/client'
import './components/monacoSetup'
import { App } from './App'
import logoUrl from './assets/editor-logo.svg'
import './styles/theme.css'

// Use the ICF Editor logo as the favicon (resolved by Vite so it works in dev
// and in the packaged file:// renderer alike).
const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']") ?? document.createElement('link')
favicon.rel = 'icon'
favicon.type = 'image/svg+xml'
favicon.href = logoUrl
document.head.appendChild(favicon)

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
