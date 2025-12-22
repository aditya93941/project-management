import { Router } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notification.controller'

const router = Router()

router.use(authenticate)

router.get('/', getNotifications)
router.put('/:id/read', markAsRead)
router.put('/read-all', markAllAsRead)

export default router
