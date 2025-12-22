import { Router } from 'express'
import authRoutes from './auth.routes'
import userRoutes from './user.routes'
import projectRoutes from './project.routes'
import taskRoutes from './task.routes'
import commentRoutes from './comment.routes'
import accessRequestRoutes from './accessRequest.routes'
import notificationRoutes from './notification.routes'
import temporaryPermissionRoutes from './temporaryPermission.routes'
import permissionRequestRoutes from './permissionRequest.routes'
import eodReportRoutes from './eodReport.routes'
import weeklySummaryRoutes from './weeklySummary.routes'
import monthlySummaryRoutes from './monthlySummary.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/projects', projectRoutes)
router.use('/tasks', taskRoutes)
router.use('/comments', commentRoutes)
router.use('/access-requests', accessRequestRoutes)
router.use('/notifications', notificationRoutes)
router.use('/temporary-permissions', temporaryPermissionRoutes)
router.use('/permission-requests', permissionRequestRoutes)
router.use('/eod-reports', eodReportRoutes)
router.use('/weekly-summaries', weeklySummaryRoutes)
router.use('/monthly-summaries', monthlySummaryRoutes)

export default router

