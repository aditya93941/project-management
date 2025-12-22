import { Request, Response } from 'express'
import { AccessRequest } from '../models/AccessRequest.model'
import { User } from '../models'
import { generateId } from '../utils/generateId'
import { createAccessRequestSchema, updateAccessRequestSchema } from '../schemas/accessRequest.schema'
import bcrypt from 'bcryptjs'
import { AccessRequestStatus } from '../models/AccessRequest.model'

export const createAccessRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createAccessRequestSchema.parse(req.body)
    const { name, email } = data

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      res.status(400).json({ message: 'User with this email already exists' })
      return
    }

    // Check if access request already exists
    const existingRequest = await AccessRequest.findOne({ email })
    if (existingRequest) {
      if (existingRequest.status === AccessRequestStatus.PENDING) {
        res.status(400).json({ message: 'Access request already pending for this email' })
        return
      }
      // If previous request was rejected, create a new one
    }

    // Create access request
    const requestId = generateId()
    const accessRequest = new AccessRequest({
      _id: requestId,
      name,
      email,
      status: AccessRequestStatus.PENDING,
      requestedAt: new Date(),
    })

    await accessRequest.save()

    res.status(201).json({
      message: 'Access request submitted successfully',
      request: accessRequest,
    })
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to create access request' })
  }
}

export const getAccessRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any
    // Only MANAGER (super admin) can view access requests
    if (authReq.user?.role !== 'MANAGER') {
      res.status(403).json({ message: 'Only super admin can view access requests' })
      return
    }

    const { status } = req.query
    const filter: any = {}
    if (status) {
      filter.status = status
    }

    const requests = await AccessRequest.find(filter)
      .sort({ requestedAt: -1 })
      .populate('reviewedBy', 'name email')

    res.json({
      data: requests,
      total: requests.length,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export const updateAccessRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any
    // Only MANAGER (super admin) can update access requests
    if (authReq.user?.role !== 'MANAGER') {
      res.status(403).json({ message: 'Only super admin can update access requests' })
      return
    }

    const { id } = req.params
    const data = updateAccessRequestSchema.parse(req.body)
    const { status } = data

    const accessRequest = await AccessRequest.findById(id)
    if (!accessRequest) {
      res.status(404).json({ message: 'Access request not found' })
      return
    }

    accessRequest.status = status as AccessRequestStatus
    accessRequest.reviewedAt = new Date()
    accessRequest.reviewedBy = authReq.userId

    await accessRequest.save()

    res.json({
      message: 'Access request updated successfully',
      request: accessRequest,
    })
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to update access request' })
  }
}

export const approveAccessRequestAndCreateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any
    // Only MANAGER (super admin) can approve and create users
    if (authReq.user?.role !== 'MANAGER') {
      res.status(403).json({ message: 'Only super admin can approve access requests' })
      return
    }

    const { id } = req.params
    const { password, role } = req.body

    if (!password || password.length < 6) {
      res.status(400).json({ message: 'Password is required and must be at least 6 characters' })
      return
    }

    const accessRequest = await AccessRequest.findById(id)
    if (!accessRequest) {
      res.status(404).json({ message: 'Access request not found' })
      return
    }

    if (accessRequest.status !== AccessRequestStatus.PENDING) {
      res.status(400).json({ message: 'Access request is not pending' })
      return
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: accessRequest.email })
    if (existingUser) {
      res.status(400).json({ message: 'User with this email already exists' })
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const userId = generateId()
    const user = new User({
      _id: userId,
      name: accessRequest.name,
      email: accessRequest.email,
      role: role || 'DEVELOPER',
      password: hashedPassword,
    })

    await user.save()

    // Update access request
    accessRequest.status = AccessRequestStatus.APPROVED
    accessRequest.reviewedAt = new Date()
    accessRequest.reviewedBy = authReq.userId

    await accessRequest.save()

    const userResponse = user.toObject()
    delete userResponse.password

    res.json({
      message: 'User created successfully',
      user: userResponse,
      request: accessRequest,
    })
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to create user' })
  }
}

