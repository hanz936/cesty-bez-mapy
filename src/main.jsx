import './instrument.js'
import './utils/cspBlocked.js'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import './styles/print.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Něco se pokazilo. Zkuste prosím obnovit stránku.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
