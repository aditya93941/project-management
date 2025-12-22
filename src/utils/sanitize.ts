/**
 * Input sanitization utilities
 * Removes potentially dangerous HTML/script tags and normalizes strings
 */

/**
 * Sanitize a string by removing HTML tags and normalizing whitespace
 */
export const sanitizeString = (input: string | undefined | null): string => {
  if (!input || typeof input !== 'string') {
    return ''
  }
  
  // Remove HTML tags
  const withoutTags = input.replace(/<[^>]*>/g, '')
  
  // Decode HTML entities
  const decoded = withoutTags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
  
  // Normalize whitespace
  return decoded.trim().replace(/\s+/g, ' ')
}

/**
 * Sanitize an object recursively
 */
export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
  if (!obj || typeof obj !== 'object') {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => 
      typeof item === 'string' ? sanitizeString(item) : sanitizeObject(item)
    ) as unknown as T
  }
  
  const sanitized: any = {}
  for (const key in obj) {
    const value = obj[key]
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value)
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized as T
}

/**
 * Validate and sanitize email
 */
export const sanitizeEmail = (email: string): string => {
  return sanitizeString(email).toLowerCase().trim()
}

/**
 * Validate string length
 */
export const validateLength = (input: string, min: number, max: number): boolean => {
  const sanitized = sanitizeString(input)
  return sanitized.length >= min && sanitized.length <= max
}

