import { Response } from 'express'
import bcrypt from 'bcryptjs'
import { User } from '../models'
import { generateId } from '../utils/generateId'
import { createUserSchema, updateUserSchema, userParamsSchema } from '../schemas'
import { AuthRequest } from '../middleware/auth.middleware'

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
    const { password, ...userData } = data
    
    // Hash password if provided
    let hashedPassword = undefined
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10)
    }
    
    const userId = generateId()
    const user = new User({
      _id: userId,
      ...userData,
      password: hashedPassword,
    })
    await user.save()
    const userResponse = user.toObject()
    delete userResponse.password
    res.status(201).json(userResponse)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = userParamsSchema.parse(req.params)
    const data = updateUserSchema.parse(req.body)
    
    const { password, ...updateData } = data
    
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

