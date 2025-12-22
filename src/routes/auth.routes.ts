import { Router } from 'express'
import { register, login, getMe } from '../controllers/auth.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'
import { registerSchema, loginSchema } from '../schemas'
import { authRateLimiter } from '../middleware/rateLimit.middleware'

const router = Router()

router.post('/register', authRateLimiter, validate(registerSchema), register)
router.post('/login', authRateLimiter, validate(loginSchema), login)
router.get('/me', authenticate, getMe)

export default router

