/**
 * Logger utility for conditional logging based on environment
 * In production, only errors and warnings are logged
 * In development, all logs are shown
 */

const isDevelopment = process.env.NODE_ENV !== 'production'

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args)
    }
  },
  
  warn: (...args: any[]) => {
    console.warn(...args)
  },
  
  error: (...args: any[]) => {
    console.error(...args)
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment || process.env.DEBUG === 'true') {
      console.debug(...args)
    }
  },
}

