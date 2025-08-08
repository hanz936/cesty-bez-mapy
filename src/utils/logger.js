/**
 * Secure logger utility
 * Prevents sensitive information leaks in production
 */

const isDevelopment = import.meta.env.MODE === 'development'
const isTest = import.meta.env.MODE === 'test'

// Safe logging that removes sensitive data
const sanitizeError = (error) => {
  if (!error) return error
  
  // Create a safe error object without sensitive information
  const safeError = {
    message: error.message || 'Unknown error',
    name: error.name || 'Error',
    stack: isDevelopment ? error.stack : undefined,
  }
  
  return safeError
}

export const logger = {
  error: (message, error, additionalInfo) => {
    if (isDevelopment || isTest) {
      console.error(message, error, additionalInfo)
    } else {
      // In production, only log safe information
      const safeError = sanitizeError(error)
      console.error(message, safeError)
      
      // TODO: Send to error monitoring service (Sentry, LogRocket, etc.)
      // errorMonitoring.captureException(safeError, { extra: additionalInfo })
    }
  },
  
  warn: (message, data) => {
    if (isDevelopment || isTest) {
      console.warn(message, data)
    }
    // Production warnings are usually suppressed
  },
  
  info: (message, data) => {
    if (isDevelopment || isTest) {
      console.log(message, data)
    }
  },
  
  debug: (message, data) => {
    if (isDevelopment) {
      console.debug(message, data)
    }
  }
}

export default logger