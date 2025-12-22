import { UserRole } from '../models/User.model'
import { ProjectMember } from '../models/Project.model'

/**
 * Check if a user has access to a project based on their role and membership
 * 
 * Rules:
 * - DEVELOPER: Can only see projects they are a member of
 * - TEAM_LEAD: Can see projects where they are team_lead OR a member
 * - GROUP_HEAD: Can see all projects (full visibility)
 * - MANAGER: Can see all projects (full visibility)
 */
export async function hasProjectAccess(
  userId: string,
  userRole: UserRole,
  projectId: string
): Promise<{ hasAccess: boolean; reason?: string }> {
  // Super Admin and Admin (MANAGER, GROUP_HEAD) have full access
  if (userRole === UserRole.MANAGER || userRole === UserRole.GROUP_HEAD) {
    return { hasAccess: true }
  }

  // TEAM_LEAD can see projects where they are team_lead or a member
  // Note: team_lead check is done in the controller by querying projects
  // This function only checks membership
  if (userRole === UserRole.TEAM_LEAD) {
    const membership = await ProjectMember.findOne({
      projectId,
      userId,
    })

    if (membership) {
      return { hasAccess: true }
    }

    // If not a member, controller will check if they are team_lead
    // Return false here, controller will handle team_lead case
    return { hasAccess: false, reason: 'You are not a member of this project' }
  }

  // DEVELOPER: Must be a member of the project
  if (userRole === UserRole.DEVELOPER) {
    const membership = await ProjectMember.findOne({
      projectId,
      userId,
    })

    if (!membership) {
      return {
        hasAccess: false,
        reason: 'You do not have access to this project. You must be a member to view it.',
      }
    }

    return { hasAccess: true }
  }

  // Default: deny access
  return { hasAccess: false, reason: 'Insufficient permissions' }
}

/**
 * Get project IDs that a user has access to
 * Used for filtering queries
 * Returns null if user has access to all projects (Admin/Super Admin)
 * Returns empty array if user has no access
 * Returns array of project IDs if user has limited access
 */
export async function getAccessibleProjectIds(
  userId: string,
  userRole: UserRole
): Promise<string[] | null> {
  // Super Admin and Admin have access to all projects (return null = no filter)
  if (userRole === UserRole.MANAGER || userRole === UserRole.GROUP_HEAD) {
    return null // null means no filter - show all
  }

  // For TEAM_LEAD and DEVELOPER, get their project memberships
  // Normalize userId to ensure proper matching (handle both string and ObjectId)
  const normalizedUserId = String(userId).trim()

  // Query with $or to handle potential type mismatches
  // This ensures we find memberships even if userId is stored in slightly different formats
  const memberships = await ProjectMember.find({
    $or: [
      { userId: normalizedUserId },
      { userId: String(userId) }, // Try without trim
      { userId: userId } // Try original value (in case it's already the right type)
    ]
  })

  // Deduplicate by _id to ensure we don't count the same membership twice
  const uniqueMemberships = Array.from(
    new Map(memberships.map(m => [String(m._id), m])).values()
  )

  console.log('[getAccessibleProjectIds] Query details:', {
    userId: normalizedUserId,
    userRole,
    membershipsFound: memberships.length,
    uniqueMemberships: uniqueMemberships.length,
    allProjectIds: uniqueMemberships.map(m => ({
      projectId: m.projectId,
      projectIdType: typeof m.projectId,
      userId: m.userId,
      userIdType: typeof m.userId,
      _id: m._id
    }))
  })

  // Extract project IDs and ensure they're strings
  const memberProjectIds = uniqueMemberships
    .map((m) => String(m.projectId).trim())
    .filter(Boolean)
    .filter((id, index, arr) => arr.indexOf(id) === index) // Remove duplicates

  // For TEAM_LEAD, we also need to include projects where they are team_lead
  // This requires importing Project model, so we'll handle it in the controller
  // For now, return member project IDs
  // The controller will add team_lead projects for TEAM_LEAD role

  console.log('[getAccessibleProjectIds] Final result:', {
    projectIds: memberProjectIds,
    count: memberProjectIds.length
  })

  return memberProjectIds.length > 0 ? memberProjectIds : []
}

