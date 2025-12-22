import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'
import { sanitizeObject } from '../utils/sanitize'

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize input before validation
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body)
      }
      schema.parse(req.body)
      next()
    } catch (error: any) {
      res.status(400).json({
        message: 'Validation error',
        errors: error.errors,
      })
    }
  }
}

export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.params)
      next()
    } catch (error: any) {
      res.status(400).json({
        message: 'Invalid parameters',
        errors: error.errors,
      })
    }
  }
}

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.query)
      next()
    } catch (error: any) {
      res.status(400).json({
        message: 'Invalid query parameters',
        errors: error.errors,
      })
    }
  }
}

