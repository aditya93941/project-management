import { TemporaryPermission } from '../models/TemporaryPermission.model'
import { Notification } from '../models/Notification.model'
import { generateId } from './generateId'

/**
 * Auto-expire temporary permissions that have passed their expiry date
 * This should be run periodically (e.g., via cron job or scheduled task)
 */
export async function expirePermissions(): Promise<{
  expiredCount: number
  error?: string
}> {
  try {
    const now = new Date()

    // Find all active permissions that have expired
    const expiredPermissions = await TemporaryPermission.find({
      isActive: true,
      expiresAt: { $lte: now },
    }).populate('userId', 'name email').populate('projectId', 'name')

    // Notify users about expired permissions before marking as inactive
    for (const permission of expiredPermissions) {
      try {
        await Notification.create({
          _id: generateId(),
          recipientId: permission.userId.toString(),
          senderId: permission.grantedBy, // System/admin who granted it
          message: `Your temporary task assignment permission for project "${(permission.projectId as any)?.name || 'Unknown'}" has expired.`,
          type: 'PERMISSION_EXPIRED',
          relatedId: permission._id,
          projectId: permission.projectId.toString(),
        })
      } catch (err) {
        console.error('Failed to create expiration notification', err)
      }
    }

    // Mark all as inactive
    const result = await TemporaryPermission.updateMany(
      {
        isActive: true,
        expiresAt: { $lte: now },
      },
      {
        $set: { isActive: false },
      }
    )

    return {
      expiredCount: result.modifiedCount,
    }
  } catch (error: any) {
    console.error('Error expiring permissions:', error)
    return {
      expiredCount: 0,
      error: error.message,
    }
  }
}

/**
 * Check for permissions expiring soon (within 3 days) and notify users
 * This should be run daily
 */
export async function checkExpiringPermissions(): Promise<{
  notifiedCount: number
  error?: string
}> {
  try {
    const now = new Date()
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    // Find permissions expiring in the next 3 days
    const expiringPermissions = await TemporaryPermission.find({
      isActive: true,
      expiresAt: {
        $gte: now,
        $lte: threeDaysFromNow,
      },
    })
      .populate('userId', 'name email')
      .populate('projectId', 'name')

    let notifiedCount = 0

    for (const permission of expiringPermissions) {
      // Check if we've already notified about this permission
      const existingNotification = await Notification.findOne({
        recipientId: permission.userId.toString(),
        type: 'PERMISSION_EXPIRING',
        relatedId: permission._id,
        createdAt: {
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Within last 24 hours
        },
      })

      if (!existingNotification) {
        try {
          const daysUntilExpiry = Math.ceil(
            (permission.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          )

          await Notification.create({
            _id: generateId(),
            recipientId: permission.userId.toString(),
            senderId: permission.grantedBy,
            message: `Your temporary task assignment permission for project "${(permission.projectId as any)?.name || 'Unknown'}" will expire in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''} (on ${permission.expiresAt.toLocaleDateString()}).`,
            type: 'PERMISSION_EXPIRING',
            relatedId: permission._id,
            projectId: permission.projectId.toString(),
          })
          notifiedCount++
        } catch (err) {
          console.error('Failed to create expiring notification', err)
        }
      }
    }

    return {
      notifiedCount,
    }
  } catch (error: any) {
    console.error('Error checking expiring permissions:', error)
    return {
      notifiedCount: 0,
      error: error.message,
    }
  }
}

