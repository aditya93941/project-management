import { Router } from 'express'
import { getWeeklySummaries, getWeeklySummaryById } from '../controllers/weeklySummary.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

// Get all weekly summaries (with RBAC)
router.get('/', getWeeklySummaries)

// Get specific weekly summary
router.get('/:id', getWeeklySummaryById)

export default router

