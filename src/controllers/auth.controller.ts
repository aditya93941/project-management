import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models'
import { generateId } from '../utils/generateId'
import { loginSchema, registerSchema } from '../schemas'

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = registerSchema.parse(req.body)
    const { name, email, password, image, role } = data

    // Check if user exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      res.status(400).json({ message: 'User already exists' })
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const userId = generateId()
    const user = new User({
      _id: userId,
      name,
      email,
      image: image || '',
      role: role || 'DEVELOPER',
      password: hashedPassword,
    })

    await user.save()

    // Validate JWT_SECRET is set
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret || jwtSecret === 'secret') {
      console.error('ERROR: JWT_SECRET is not set or using default value. This is a security risk!')
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ message: 'Server configuration error' })
        return
      }
    }

    // Generate token with user role
    const token = jwt.sign(
      { 
        userId: user._id,
        role: user.role 
      }, 
      jwtSecret || 'secret', 
      {
        expiresIn: '7d',
      }
    )

    const userResponse = user.toObject()
    delete userResponse.password

    res.status(201).json({
      user: userResponse,
      token,
    })
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Registration failed' })
  }
}

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = loginSchema.parse(req.body)
    const { email, password } = data

    // Find user with password
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password')
    if (!user || !user.password) {
      res.status(401).json({ message: 'Invalid credentials' })
      return
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      res.status(401).json({ message: 'Invalid credentials' })
      return
    }

    // Generate token with user role
    const token = jwt.sign(
      { 
        userId: user._id,
        role: user.role 
      }, 
      process.env.JWT_SECRET || 'secret', 
      {
        expiresIn: '7d',
      }
    )

    const userResponse = user.toObject()
    delete userResponse.password

    res.json({
      user: userResponse,
      token,
    })
  } catch (error: any) {
    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      res.status(400).json({ 
        message: error.errors?.[0]?.message || 'Invalid input data' 
      })
      return
    }
    
    // Handle database connection errors
    if (error.message?.includes('connection') || error.message?.includes('SSL')) {
      console.error('Database connection error during login:', error)
      res.status(500).json({ 
        message: 'Database connection error. Please try again later.' 
      })
      return
    }
    
    console.error('Login error:', error)
    res.status(400).json({ message: error.message || 'Login failed' })
  }
}

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any
    const user = await User.findById(authReq.userId).select('-password')
    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }
    res.json(user)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

