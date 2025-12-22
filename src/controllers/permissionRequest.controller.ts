import { Response } from 'express'
import { PermissionRequest, PermissionRequestStatus, User, Project, TemporaryPermission, Notification } from '../models'
import { generateId } from '../utils/generateId'
import {
  createPermissionRequestSchema,
  reviewPermissionRequestSchema,
  permissionRequestParamsSchema,
} from '../schemas'
import { AuthRequest } from '../middleware/auth.middleware'
import { UserRole } from '../models/User.model'

/**
 * Create a permission request (Developers only)
 */
export const createPermissionRequest = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const data = createPermissionRequestSchema.parse(req.body)
    const requesterId = req.user?.id
    const requesterRole = req.user?.role

    // Only developers can request permissions
    if (requesterRole !== UserRole.DEVELOPER) {
      res.status(403).json({
        message: 'Only developers can request temporary assignment permissions',
      })
      return
    }

    // Verify project exists
    const project = await Project.findById(data.projectId)
    if (!project) {
      res.status(404).json({ message: 'Project not found' })
      return
    }

    // Check if there's already a pending request for this user+project
    const existingRequest = await PermissionRequest.findOne({
      requestedBy: requesterId,
      projectId: data.projectId,
      status: PermissionRequestStatus.PENDING,
    })

    if (existingRequest) {
      res.status(400).json({
        message: 'You already have a pending request for this project',
      })
      return
    }

    // Check if user already has an active permission for this project
    const now = new Date()
    const existingPermission = await TemporaryPermission.findOne({
      userId: requesterId,
      projectId: data.projectId,
      isActive: true,
      expiresAt: { $gt: now },
    })

    if (existingPermission) {
      res.status(400).json({
        message: 'You already have an active permission for this project',
      })
      return
    }

    // Create the request
    const requestId = generateId()
    const request = new PermissionRequest({
      _id: requestId,
      requestedBy: requesterId!,
      projectId: data.projectId,
      requestedDurationDays: data.requestedDurationDays,
      reason: data.reason,
      status: PermissionRequestStatus.PENDING,
    })

    await request.save()

    // Notify all Admins and Managers about the new request
    try {
      const admins = await User.find({
        role: { $in: [UserRole.MANAGER, UserRole.GROUP_HEAD] },
      })

      const project = await Project.findById(data.projectId)
      const requester = await User.findById(requesterId)

      for (const admin of admins) {
        await Notification.create({
          _id: generateId(),
          recipientId: admin._id,
          senderId: requesterId!,
          message: `${requester?.name || 'A developer'} requested temporary task assignment permission for project "${project?.name || 'Unknown'}" for ${data.requestedDurationDays} days.`,
          type: 'PERMISSION_REQUESTED',
          relatedId: requestId,
        })
      }
    } catch (err) {
      console.error('Failed to create notification for admins', err)
    }

    const populated = await PermissionRequest.findById(requestId)
      .populate('requestedBy', 'name email')
      .populate('projectId', 'name')

    res.status(201).json(populated)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

/**
 * Get all permission requests (Admin/Manager only)
 */
export const getPermissionRequests = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit

    const filter: any = {}
    if (req.query.status) {
      filter.status = req.query.status
    }
    if (req.query.projectId) {
      filter.projectId = req.query.projectId
    }

    const requests = await PermissionRequest.find(filter)
      .populate('requestedBy', 'name email role')
      .populate('projectId', 'name')
      .populate('reviewedBy', 'name email role')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })

    const total = await PermissionRequest.countDocuments(filter)

    res.json({
      data: requests,
      total,
      page,
      limit,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Get my permission requests (for the current user)
 */
export const getMyPermissionRequests = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id

    const requests = await PermissionRequest.find({
      requestedBy: userId,
    })
      .populate('projectId', 'name')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })

    res.json({ data: requests })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Review (approve/reject) a permission request (Admin/Manager only)
 */
export const reviewPermissionRequest = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = permissionRequestParamsSchema.parse(req.params)
    const data = reviewPermissionRequestSchema.parse(req.body)
    const reviewerId = req.user?.id
    const reviewerRole = req.user?.role

    // Only MANAGER, GROUP_HEAD can review requests
    if (!reviewerRole || ![UserRole.MANAGER, UserRole.GROUP_HEAD].includes(reviewerRole)) {
      res.status(403).json({
        message: 'Only Admins (Group Leads) and Managers can review permission requests',
      })
      return
    }

    const request = await PermissionRequest.findById(id)
      .populate('requestedBy', 'name email role')
      .populate('projectId', 'name')

    if (!request) {
      res.status(404).json({ message: 'Permission request not found' })
      return
    }

    if (request.status !== PermissionRequestStatus.PENDING) {
      res.status(400).json({
        message: 'This request has already been reviewed',
      })
      return
    }

    // Verify requester is a developer
    const requester = request.requestedBy as any
    if (requester.role !== UserRole.DEVELOPER) {
      res.status(400).json({
        message: 'Permission requests can only be made by developers',
      })
      return
    }

    // Update request status
    request.status = data.status as PermissionRequestStatus
    request.reviewedBy = reviewerId!
    request.reviewedAt = new Date()
    if (data.reviewNotes) {
      request.reviewNotes = data.reviewNotes
    }

    await request.save()

    // If approved, create the temporary permission
    if (data.status === 'APPROVED') {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + request.requestedDurationDays)

      // Check if permission already exists (shouldn't, but just in case)
      const existingPermission = await TemporaryPermission.findOne({
        userId: request.requestedBy.toString(),
        projectId: request.projectId.toString(),
        isActive: true,
        expiresAt: { $gt: new Date() },
      })

      if (!existingPermission) {
        const permissionId = generateId()
        const permission = new TemporaryPermission({
          _id: permissionId,
          userId: request.requestedBy.toString(),
          projectId: request.projectId.toString(),
          grantedBy: reviewerId!,
          expiresAt,
          isActive: true,
          reason: `Approved request: ${request.reason}`,
        })

        await permission.save()
      }

      // Create notification for the requester
      try {
        const { Notification } = await import('../models')
        await Notification.create({
          _id: generateId(),
          recipientId: request.requestedBy.toString(),
          senderId: reviewerId!,
          message: `Your request for temporary task assignment permission in project "${(request.projectId as any).name}" has been approved for ${request.requestedDurationDays} days.`,
          type: 'PERMISSION_APPROVED',
          relatedId: request._id,
          projectId: request.projectId.toString(),
        })
      } catch (err) {
        console.error('Failed to create notification', err)
      }
    } else {
      // Create notification for rejection
      try {
        const { Notification } = await import('../models')
        await Notification.create({
          _id: generateId(),
          recipientId: request.requestedBy.toString(),
          senderId: reviewerId!,
          message: `Your request for temporary task assignment permission in project "${(request.projectId as any).name}" has been rejected.${data.reviewNotes ? ` Reason: ${data.reviewNotes}` : ''}`,
          type: 'PERMISSION_REJECTED',
          relatedId: request._id,
          projectId: request.projectId.toString(),
        })
      } catch (err) {
        console.error('Failed to create notification', err)
      }
    }

    const populated = await PermissionRequest.findById(id)
      .populate('requestedBy', 'name email role')
      .populate('projectId', 'name')
      .populate('reviewedBy', 'name email role')

    res.json(populated)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

