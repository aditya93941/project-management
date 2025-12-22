import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { User } from '../models'

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
    if (!jwtSecret || jwtSecret === 'secret') {
      console.error('ERROR: JWT_SECRET is not set or using default value. This is a security risk!')
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ message: 'Server configuration error' })
        return
      }
    }

    const decoded = jwt.verify(token, jwtSecret || 'secret') as {
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
      console.error('Database error during authentication:', error)
      res.status(500).json({ message: 'Database connection error. Please try again later.' })
      return
    }
    
    // For other errors, log them and return generic auth failure
    console.error('Authentication error:', error)
    res.status(401).json({ message: 'Authentication failed' })
  }
}

