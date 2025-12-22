import { Router } from 'express'
import {
  createAccessRequest,
  getAccessRequests,
  updateAccessRequest,
  approveAccessRequestAndCreateUser,
} from '../controllers/accessRequest.controller'
import { authenticate } from '../middleware/auth.middleware'
import { authorize } from '../middleware/authorize.middleware'
import { UserRole } from '../models/User.model'

const router = Router()

// Public route - anyone can request access
router.post('/', createAccessRequest)

// Protected routes - only super admin (MANAGER) can access
router.get('/', authenticate, authorize(UserRole.MANAGER), getAccessRequests)
router.put('/:id', authenticate, authorize(UserRole.MANAGER), updateAccessRequest)
router.post('/:id/approve', authenticate, authorize(UserRole.MANAGER), approveAccessRequestAndCreateUser)

export default router

