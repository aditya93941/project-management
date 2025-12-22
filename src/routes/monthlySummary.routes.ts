import { Router } from 'express'
import { getMonthlySummaries, getMonthlySummaryById } from '../controllers/monthlySummary.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

// Get all monthly summaries (with RBAC)
router.get('/', getMonthlySummaries)

// Get specific monthly summary
router.get('/:id', getMonthlySummaryById)

export default router

