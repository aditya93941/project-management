import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { User } from '../models'
import { logger } from '../utils/logger'

export interface AuthRequest extends Request {
  userId?: string
  user?: any
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret || jwtSecret === 'secret' || jwtSecret.length < 32) {
      const errorMsg = 'JWT_SECRET is not properly configured. Must be at least 32 characters long.'
      logger.error(errorMsg)
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ message: 'Server configuration error' })
        return
      }
      // In development, still throw error to prevent using insecure secret
      res.status(500).json({ message: errorMsg })
      return
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string
      exp?: number
    }

    // Check if token is expired (jwt.verify already does this, but be explicit)
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      res.status(401).json({ message: 'Token expired' })
      return
    }

    const user = await User.findById(decoded.userId).select('-password')
    if (!user) {
      res.status(401).json({ message: 'User not found' })
      return
    }

    req.userId = decoded.userId
    req.user = user
    next()
  } catch (error: any) {
    // Provide more specific error messages
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ message: 'Token expired' })
      return
    }
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ message: 'Invalid token' })
      return
    }
    
    // Handle database connection errors separately - these are server issues, not auth issues
    if (error.message?.includes('connection') || 
        error.message?.includes('timeout') || 
        error.message?.includes('network') ||
        error.name === 'MongoNetworkError' ||
        error.name === 'MongoServerError') {
      logger.error('Database error during authentication:', error)
      res.status(500).json({ message: 'Database connection error. Please try again later.' })
      return
    }
    
    // For other errors, log them and return generic auth failure
    logger.error('Authentication error:', error)
    res.status(401).json({ message: 'Authentication failed' })
  }
}

