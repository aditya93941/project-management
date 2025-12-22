import { Router } from 'express'
import {
  grantTemporaryPermission,
  revokeTemporaryPermission,
  getTemporaryPermissions,
  getTemporaryPermissionById,
  getMyTemporaryPermissions,
} from '../controllers/temporaryPermission.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate, validateParams } from '../middleware/validate.middleware'
import {
  grantTemporaryPermissionSchema,
  temporaryPermissionParamsSchema,
} from '../schemas'
import { authorize } from '../middleware/authorize.middleware'
import { UserRole } from '../models/User.model'

const router = Router()

router.use(authenticate)

// Get my own temporary permissions (any authenticated user)
router.get('/my', getMyTemporaryPermissions)

// Get all temporary permissions (Admin/Manager only)
router.get(
  '/',
  authorize(UserRole.MANAGER, UserRole.GROUP_HEAD),
  getTemporaryPermissions
)

// Get specific permission (Admin/Manager only)
router.get(
  '/:id',
  authorize(UserRole.MANAGER, UserRole.GROUP_HEAD),
  validateParams(temporaryPermissionParamsSchema),
  getTemporaryPermissionById
)

// Grant temporary permission (Admin/Manager only)
router.post(
  '/grant',
  authorize(UserRole.MANAGER, UserRole.GROUP_HEAD),
  validate(grantTemporaryPermissionSchema),
  grantTemporaryPermission
)

// Revoke temporary permission (Admin/Manager only)
router.delete(
  '/:id',
  authorize(UserRole.MANAGER, UserRole.GROUP_HEAD),
  validateParams(temporaryPermissionParamsSchema),
  revokeTemporaryPermission
)

export default router

