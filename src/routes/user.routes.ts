import { Router } from 'express'
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/user.controller'
import { authenticate } from '../middleware/auth.middleware'
import { authorize, authorizeMinimum } from '../middleware/authorize.middleware'
import { validate, validateParams } from '../middleware/validate.middleware'
import {
  createUserSchema,
  updateUserSchema,
  userParamsSchema,
} from '../schemas'
import { UserRole } from '../models/User.model'

const router = Router()

router.use(authenticate)

// All authenticated users can view users
router.get('/', getUsers)
router.get('/:id', validateParams(userParamsSchema), getUserById)

// Only MANAGER and GROUP_HEAD can create users
router.post('/', authorizeMinimum(UserRole.GROUP_HEAD), validate(createUserSchema), createUser)

// Only MANAGER and GROUP_HEAD can update users
router.put('/:id', authorizeMinimum(UserRole.GROUP_HEAD), validateParams(userParamsSchema), validate(updateUserSchema), updateUser)

// Only MANAGER can delete users
router.delete('/:id', authorize(UserRole.MANAGER), validateParams(userParamsSchema), deleteUser)

export default router

