import { Response } from 'express'
import bcrypt from 'bcryptjs'
import { User } from '../models'
import { generateId } from '../utils/generateId'
import crypto from 'crypto'
import { createUserSchema, updateUserSchema, userParamsSchema } from '../schemas'
import { AuthRequest } from '../middleware/auth.middleware'
import { emailService } from '../utils/emailService'
import { logger } from '../utils/logger'

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit
    const includeTotal = req.query.includeTotal !== 'false' // Allow skipping count for speed

    // Optimize: Run query and count in parallel for better performance
    const [users, total] = await Promise.all([
      User.find()
        .select('-password')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(), // Use lean() for faster queries (returns plain objects)
      includeTotal ? User.countDocuments() : Promise.resolve(0)
    ])

    res.json({
      data: users,
      total,
      page,
      limit,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = userParamsSchema.parse(req.params)
    const user = await User.findById(id).select('-password')
    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }
    res.json(user)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = createUserSchema.parse(req.body)

    // Generate random password if not provided
    const generatedPassword = data.password || crypto.randomBytes(8).toString('hex')

    // Hash password
    const hashedPassword = await bcrypt.hash(generatedPassword, 10)

    // Fallback name to email username if not provided
    const userName = data.name || data.email.split('@')[0]

    const userId = generateId()
    const user = new User({
      _id: userId,
      name: userName,
      email: data.email,
      role: data.role || 'DEVELOPER',
      image: data.image || '',
      password: hashedPassword,
    })

    await user.save()

    // Send invitation email
    // We don't await this to prevent blocking the response
    emailService.sendInvitation({
      email: user.email,
      name: user.name,
      password: generatedPassword,
      role: user.role,
      loginUrl: process.env.FRONTEND_URL
    }).catch(err => {
      logger.error(`Failed to send invitation email to ${user.email}:`, err)
    })

    const userResponse = user.toObject()
    delete userResponse.password

    // Return the generated password so the admin can see it (optional, but helpful if email fails)
    // Note: In a stricter security environment, we might NOT return this and rely solely on email
    res.status(201).json({
      ...userResponse,
      _tempPassword: generatedPassword
    })
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'User with this email already exists' })
      return
    }
    res.status(400).json({ message: error.message })
  }
}

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = userParamsSchema.parse(req.params)
    const data = updateUserSchema.parse(req.body)
    const userId = req.userId
    const userRole = req.user?.role

    // Allow users to update their own profile, or require GROUP_HEAD+ for updating others
    const isSelfUpdate = userId === id
    const isAuthorized = isSelfUpdate || userRole === 'MANAGER' || userRole === 'GROUP_HEAD'

    if (!isAuthorized) {
      res.status(403).json({ message: 'You can only update your own profile or need GROUP_HEAD+ role to update others' })
      return
    }

    // For self-updates, restrict what can be changed (no role changes)
    const { password, role, email, ...updateData } = data
    if (isSelfUpdate) {
      // Users can only update their own name, password, and image
      if (data.name) updateData.name = data.name
      if (data.image) updateData.image = data.image
      // Don't allow role or email changes for self-updates
    } else {
      // Admins can update everything including role and email
      if (data.name) updateData.name = data.name
      if (data.image) updateData.image = data.image
      if (data.role) updateData.role = data.role
      if (data.email) updateData.email = data.email
    }

    // If password is provided, hash it
    if (password) {
      (updateData as any).password = await bcrypt.hash(password, 10)
    }

    const user = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password')
    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }
    res.json(user)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = userParamsSchema.parse(req.params)
    const user = await User.findByIdAndDelete(id)
    if (!user) {
      res.status(404).json({ message: 'User not found' })
      return
    }
    res.json({ message: 'User deleted successfully' })
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

