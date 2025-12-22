import { Router } from 'express'
import {
  createPermissionRequest,
  getPermissionRequests,
  getMyPermissionRequests,
  reviewPermissionRequest,
} from '../controllers/permissionRequest.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate, validateParams } from '../middleware/validate.middleware'
import {
  createPermissionRequestSchema,
  reviewPermissionRequestSchema,
  permissionRequestParamsSchema,
} from '../schemas'
import { authorize } from '../middleware/authorize.middleware'
import { UserRole } from '../models/User.model'

const router = Router()

router.use(authenticate)

// Get my own permission requests (any authenticated user)
router.get('/my', getMyPermissionRequests)

// Get all permission requests (Admin/Manager only)
router.get(
  '/',
  authorize(UserRole.MANAGER, UserRole.GROUP_HEAD),
  getPermissionRequests
)

// Create permission request (Developers only)
router.post(
  '/',
  validate(createPermissionRequestSchema),
  createPermissionRequest
)

// Review permission request (Admin/Manager only)
router.put(
  '/:id/review',
  authorize(UserRole.MANAGER, UserRole.GROUP_HEAD),
  validateParams(permissionRequestParamsSchema),
  validate(reviewPermissionRequestSchema),
  reviewPermissionRequest
)

export default router

