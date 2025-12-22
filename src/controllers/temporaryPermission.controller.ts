import { Response } from 'express'
import { TemporaryPermission, User, Project } from '../models'
import { generateId } from '../utils/generateId'
import {
  grantTemporaryPermissionSchema,
  temporaryPermissionParamsSchema,
} from '../schemas'
import { AuthRequest } from '../middleware/auth.middleware'
import { UserRole } from '../models/User.model'

/**
 * Grant temporary task assignment permission to a developer
 * Only Admin (GROUP_HEAD), Manager (MANAGER), or Super Admin can grant
 */
export const grantTemporaryPermission = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const data = grantTemporaryPermissionSchema.parse(req.body)
    const grantorId = req.user?.id
    const grantorRole = req.user?.role

    // Only MANAGER, GROUP_HEAD can grant permissions
    if (!grantorRole || ![UserRole.MANAGER, UserRole.GROUP_HEAD].includes(grantorRole)) {
      res.status(403).json({
        message: 'Only Admins (Group Leads) and Managers can grant temporary permissions',
      })
      return
    }

    // Verify target user exists and is a DEVELOPER
    const targetUser = await User.findById(data.userId)
    if (!targetUser) {
      res.status(404).json({ message: 'Target user not found' })
      return
    }

    if (targetUser.role !== UserRole.DEVELOPER) {
      res.status(400).json({
        message: 'Temporary permissions can only be granted to developers',
      })
      return
    }

    // Verify project exists
    const project = await Project.findById(data.projectId)
    if (!project) {
      res.status(404).json({ message: 'Project not found' })
      return
    }

    // Calculate expiry date
    let expiresAt: Date
    if (data.customExpiryDate) {
      expiresAt = data.customExpiryDate
      // Ensure expiry is in the future
      if (expiresAt <= new Date()) {
        res.status(400).json({ message: 'Expiry date must be in the future' })
        return
      }
    } else {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + (data.durationDays || 7))
    }

    // Check if there's already an active permission for this user+project
    const existingPermission = await TemporaryPermission.findOne({
      userId: data.userId,
      projectId: data.projectId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })

    if (existingPermission) {
      // Update existing permission instead of creating duplicate
      existingPermission.expiresAt = expiresAt
      existingPermission.grantedBy = grantorId!
      existingPermission.reason = data.reason
      await existingPermission.save()

      const populated = await TemporaryPermission.findById(existingPermission._id)
        .populate('userId', 'name email role')
        .populate('projectId', 'name')
        .populate('grantedBy', 'name email role')

      res.json({
        ...populated?.toObject(),
        message: 'Existing permission updated',
      })
      return
    }

    // Create new permission
    const permissionId = generateId()
    const permission = new TemporaryPermission({
      _id: permissionId,
      userId: data.userId,
      projectId: data.projectId,
      grantedBy: grantorId!,
      expiresAt,
      isActive: true,
      reason: data.reason,
    })

    await permission.save()

    const populated = await TemporaryPermission.findById(permissionId)
      .populate('userId', 'name email role')
      .populate('projectId', 'name')
      .populate('grantedBy', 'name email role')

    // Notify the developer that permission was granted
    try {
      const { Notification } = await import('../models')
      const days = Math.ceil((expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      await Notification.create({
        _id: generateId(),
        recipientId: data.userId,
        senderId: grantorId!,
        message: `You have been granted temporary task assignment permission for project "${project.name}" for ${days} day${days !== 1 ? 's' : ''}. This permission expires on ${expiresAt.toLocaleDateString()}.`,
        type: 'PERMISSION_GRANTED',
        relatedId: permissionId,
        projectId: data.projectId,
      })
    } catch (err) {
      console.error('Failed to create notification', err)
    }

    res.status(201).json(populated)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

/**
 * Revoke a temporary permission (mark as inactive)
 */
export const revokeTemporaryPermission = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = temporaryPermissionParamsSchema.parse(req.params)
    const revokerId = req.user?.id
    const revokerRole = req.user?.role

    // Only MANAGER, GROUP_HEAD can revoke permissions
    if (!revokerRole || ![UserRole.MANAGER, UserRole.GROUP_HEAD].includes(revokerRole)) {
      res.status(403).json({
        message: 'Only Admins (Group Leads) and Managers can revoke temporary permissions',
      })
      return
    }

    const permission = await TemporaryPermission.findById(id)
    if (!permission) {
      res.status(404).json({ message: 'Permission not found' })
      return
    }

    permission.isActive = false
    await permission.save()

    // Notify the developer that permission was revoked
    try {
      const { Notification } = await import('../models')
      const populatedPermission = await TemporaryPermission.findById(id)
        .populate('userId', 'name email')
        .populate('projectId', 'name')
        .populate('grantedBy', 'name email')

      if (populatedPermission) {
        await Notification.create({
          _id: generateId(),
          recipientId: populatedPermission.userId.toString(),
          senderId: revokerId!,
          message: `Your temporary task assignment permission for project "${(populatedPermission.projectId as any)?.name || 'Unknown'}" has been revoked.`,
          type: 'PERMISSION_REVOKED',
          relatedId: id,
          projectId: populatedPermission.projectId.toString(),
        })
      }
    } catch (err) {
      console.error('Failed to create notification', err)
    }

    res.json({ message: 'Permission revoked successfully', permission })
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

/**
 * Get all temporary permissions (with filters)
 */
export const getTemporaryPermissions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit

    const filter: any = {}
    if (req.query.userId) filter.userId = req.query.userId
    if (req.query.projectId) filter.projectId = req.query.projectId
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true'
    }

    const permissions = await TemporaryPermission.find(filter)
      .populate('userId', 'name email role')
      .populate('projectId', 'name')
      .populate('grantedBy', 'name email role')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })

    const total = await TemporaryPermission.countDocuments(filter)

    res.json({
      data: permissions,
      total,
      page,
      limit,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Get a specific temporary permission
 */
export const getTemporaryPermissionById = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = temporaryPermissionParamsSchema.parse(req.params)
    const permission = await TemporaryPermission.findById(id)
      .populate('userId', 'name email role')
      .populate('projectId', 'name')
      .populate('grantedBy', 'name email role')

    if (!permission) {
      res.status(404).json({ message: 'Permission not found' })
      return
    }

    res.json(permission)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

/**
 * Get active permissions for current user
 */
export const getMyTemporaryPermissions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id
    const now = new Date()

    console.log('[getMyTemporaryPermissions] Fetching permissions for user:', userId)

    const permissions = await TemporaryPermission.find({
      userId,
      isActive: true,
      expiresAt: { $gt: now },
    })
      .populate('projectId', '_id name') // Include _id in populate
      .populate('grantedBy', 'name email')
      .sort({ expiresAt: 1 })

    console.log('[getMyTemporaryPermissions] Found permissions:', {
      count: permissions.length,
      permissions: permissions.map(p => ({
        _id: p._id,
        userId: p.userId,
        projectId: p.projectId,
        projectIdType: typeof p.projectId,
        isActive: p.isActive,
        expiresAt: p.expiresAt
      }))
    })

    res.json({ data: permissions })
  } catch (error: any) {
    console.error('[getMyTemporaryPermissions] Error:', error)
    res.status(500).json({ message: error.message })
  }
}

