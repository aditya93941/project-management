import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth.middleware'
import { UserRole } from '../models/User.model'

// Role hierarchy: MANAGER > GROUP_HEAD > TEAM_LEAD > DEVELOPER
const roleHierarchy: Record<UserRole, number> = {
  [UserRole.MANAGER]: 4,
  [UserRole.GROUP_HEAD]: 3,
  [UserRole.TEAM_LEAD]: 2,
  [UserRole.DEVELOPER]: 1,
}

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }

    const userRole = req.user.role as UserRole
    const hasAccess = allowedRoles.includes(userRole)

    if (!hasAccess) {
      res.status(403).json({ message: 'Insufficient permissions' })
      return
    }

    next()
  }
}

export const authorizeMinimum = (minimumRole: UserRole) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }

    const userRole = req.user.role as UserRole
    const userLevel = roleHierarchy[userRole] || 0
    const requiredLevel = roleHierarchy[minimumRole] || 0

    if (userLevel < requiredLevel) {
      res.status(403).json({ message: 'Insufficient permissions' })
      return
    }

    next()
  }
}

