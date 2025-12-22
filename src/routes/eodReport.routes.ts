import { Router } from 'express'
import {
  getEODReports,
  getEODReportById,
  getMyTodayEOD,
  createOrUpdateEODReport,
  submitEODReport,
  getEODReportsSummary,
} from '../controllers/eodReport.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate, validateParams, validateQuery } from '../middleware/validate.middleware'
import {
  createEODReportSchema,
  submitEODReportSchema,
  eodReportParamsSchema,
  eodReportQuerySchema,
} from '../schemas'

const router = Router()

router.use(authenticate)

// Get today's EOD for current user
router.get('/my/today', getMyTodayEOD)

// Get EOD reports summary for managers (Group Head / Manager)
router.get('/summary', validateQuery(eodReportQuerySchema), getEODReportsSummary)

// Get all EOD reports (with RBAC)
router.get('/', validateQuery(eodReportQuerySchema), getEODReports)

// Get specific EOD report
router.get('/:id', validateParams(eodReportParamsSchema), getEODReportById)

// Create or update today's EOD report (draft)
router.post('/', validate(createEODReportSchema), createOrUpdateEODReport)

// Submit EOD report
router.post('/submit', validate(submitEODReportSchema), submitEODReport)

export default router

