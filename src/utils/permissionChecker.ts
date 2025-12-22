import { UserRole } from '../models/User.model'
import { TemporaryPermission } from '../models/TemporaryPermission.model'

/**
 * Check if a user can assign tasks to another developer
 * Priority: Role → Temporary Permission → Deny
 */
export async function canAssignTasks(
  userId: string,
  userRole: UserRole,
  targetProjectId: string
): Promise<{ canAssign: boolean; reason?: string }> {
  // Role-based check: Managers, Group Heads, and Team Leads can always assign
  const rolesThatCanAssign = [UserRole.MANAGER, UserRole.GROUP_HEAD, UserRole.TEAM_LEAD]
  if (rolesThatCanAssign.includes(userRole)) {
    return { canAssign: true }
  }

  // Developers need temporary permission
  if (userRole === UserRole.DEVELOPER) {
    // Check for active temporary permission
    const now = new Date()
    const permission = await TemporaryPermission.findOne({
      userId,
      projectId: targetProjectId,
      isActive: true,
      expiresAt: { $gt: now },
    })

    if (permission) {
      return { canAssign: true }
    }

    return {
      canAssign: false,
      reason: 'You do not have permission to assign tasks. Please request temporary assignment permission from an Admin or Group Lead.',
    }
  }

  return { canAssign: false, reason: 'Insufficient permissions' }
}

/**
 * Check if a user can assign tasks to a specific target user
 * Additional validation: target must be a developer
 */
export async function canAssignTaskToUser(
  userId: string,
  userRole: UserRole,
  _targetUserId: string,
  targetProjectId: string,
  targetUserRole: UserRole
): Promise<{ canAssign: boolean; reason?: string }> {
  // Can only assign to developers
  if (targetUserRole !== UserRole.DEVELOPER) {
    return {
      canAssign: false,
      reason: 'Tasks can only be assigned to developers',
    }
  }

  // Check base assignment permission
  const baseCheck = await canAssignTasks(userId, userRole, targetProjectId)
  if (!baseCheck.canAssign) {
    return baseCheck
  }

  return { canAssign: true }
}

