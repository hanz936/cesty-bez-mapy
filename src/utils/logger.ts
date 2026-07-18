/**
 * Secure logger utility
 * Prevents sensitive information leaks in production
 */

import * as Sentry from '@sentry/react'

const isDevelopment = import.meta.env.MODE === 'development'
const isTest = import.meta.env.MODE === 'test'

interface SafeError {
  message: string
  name: string
  stack?: string
}

// Safe logging that removes sensitive data
const sanitizeError = (error: unknown) => {
  if (!error) return error

  // Create a safe error object without sensitive information
  // Type assertion: callers pass Error-like objects (React error boundaries,
  // catch(err)) or null/undefined (handled above); no runtime shape check
  // existed before the migration, so none is added here.
  const err = error as { message?: string; name?: string; stack?: string }
  const safeError: SafeError = {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string message must fall through to fallback (?? would change behavior)
    message: err.message || 'Unknown error',
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string name must fall through to fallback (?? would change behavior)
    name: err.name || 'Error',
    stack: isDevelopment ? err.stack : undefined,
  }

  return safeError
}

export const logger = {
  error: (message: string, error?: unknown, additionalInfo?: unknown): void => {
    if (isDevelopment || isTest) {
      console.error(message, error, additionalInfo)
    } else {
      // In production, only log safe information
      const safeError = sanitizeError(error)
      console.error(message, safeError)
    }
    // Breadcrumb: no-op bez Sentry initu (dev/test/prerender); v produkci se odešle
    // jen přiložený k případnému pozdějšímu eventu. Skutečné chyby aplikace hlásí
    // call-sites přes Sentry.captureException (vzor reviews) — logger eventy netvoří.
    // POZOR: do message nikdy PII (e-maily apod.) — message odchází do Sentry.
    Sentry.addBreadcrumb({ category: 'logger', level: 'error', message })
  },

  warn: (message: string, data?: unknown): void => {
    if (isDevelopment || isTest) {
      console.warn(message, data)
    }
    // Breadcrumb jen z message — `data` záměrně ne (PII disciplína), viz error výše.
    Sentry.addBreadcrumb({ category: 'logger', level: 'warning', message })
  },

  info: (message: string, data?: unknown): void => {
    if (isDevelopment || isTest) {
      console.log(message, data)
    }
  },

  debug: (message: string, data?: unknown): void => {
    if (isDevelopment) {
      console.debug(message, data)
    }
  }
}

export default logger