import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { EODReport, EODStatus, EODTask, EODTaskStatus, UserRole, Task, ProjectMember, Project } from '../models'
import { TaskStatus } from '../types'
import { generateId } from '../utils/generateId'
import {
  createEODReportSchema,
  updateEODReportSchema,
  submitEODReportSchema,
  eodReportParamsSchema,
  eodReportQuerySchema,
} from '../schemas'

/**
 * Get EOD reports with RBAC
 * - Developer: Only their own reports
 * - Team Lead: Their team's reports
 * - Group Head: All reports in their group
 * - Manager: All reports
 */
export const getEODReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user
    if (!user) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }

    const query = eodReportQuerySchema.parse(req.query)
    const { userId, startDate, endDate } = query

    // Build filter based on role
    const filter: any = {}

    if (user.role === UserRole.DEVELOPER) {
      // Developers can only see their own reports
      filter.userId = user.id
    } else if (user.role === UserRole.TEAM_LEAD) {
      // Team Leads can see their team's reports (would need team membership logic)
      // For now, same as developer - can be extended
      filter.userId = userId || user.id
    } else if (user.role === UserRole.GROUP_HEAD || user.role === UserRole.MANAGER) {
      // Group Heads and Managers can see all reports
      if (userId) {
        filter.userId = userId
      }
    }

    // Date filters
    if (startDate || endDate) {
      filter.reportDate = {}
      if (startDate) {
        filter.reportDate.$gte = new Date(startDate)
      }
      if (endDate) {
        filter.reportDate.$lte = new Date(endDate)
      }
    }

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 50
    const skip = (page - 1) * limit

    const [reports, total] = await Promise.all([
      EODReport.find(filter)
        .populate('userId', 'name email role')
        .sort({ reportDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EODReport.countDocuments(filter),
    ])

    // Get task details for each report
    const reportsWithTasks = await Promise.all(
      reports.map(async (report) => {
        const eodTasks = await EODTask.find({ eodReportId: report._id })
          .populate('taskId', 'title status type priority')
          .lean()

        return {
          ...report,
          tasks: eodTasks.map(et => ({
            taskId: et.taskId,
            status: et.status,
            progress: et.progress,
            task: typeof et.taskId === 'object' ? et.taskId : null,
          })),
        }
      })
    )

    res.json({
      data: reportsWithTasks,
      total,
      page,
      limit,
    })
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

/**
 * Get a specific EOD report
 */
export const getEODReportById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = eodReportParamsSchema.parse(req.params)
    const user = req.user

    if (!user) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }

    const report = await EODReport.findById(id).populate('userId', 'name email role').lean()

    if (!report) {
      res.status(404).json({ message: 'EOD report not found' })
      return
    }

    // RBAC check
    if (user.role === UserRole.DEVELOPER && report.userId !== user.id) {
      res.status(403).json({ message: 'You can only view your own EOD reports' })
      return
    }

    // Get associated tasks
    const eodTasks = await EODTask.find({ eodReportId: id })
      .populate('taskId', 'title status type priority')
      .lean()

    const response = {
      ...report,
      tasks: eodTasks.map(et => ({
        taskId: et.taskId,
        status: et.status,
        progress: et.progress,
        task: typeof et.taskId === 'object' ? et.taskId : null,
      })),
    }

    res.json(response)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

/**
 * Helper function to check if report is editable
 * Reports are editable if:
 * - Not final (isFinal = false)
 * - And either draft OR submitted but before end of day
 */
function isReportEditable(report: any): boolean {
  if (report.isFinal) return false

  const now = new Date()
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)

  // If submitted but before end of day, still editable
  if (report.status === EODStatus.SUBMITTED && now <= endOfDay) {
    return true
  }

  // Draft is always editable (if not final)
  return report.status === EODStatus.DRAFT
}

/**
 * Get today's EOD report for current user
 */
export const getMyTodayEOD = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user
    if (!user) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Run report fetch and status changes in parallel for faster response
    const [report, statusChanges] = await Promise.all([
      EODReport.findOne({
        userId: user.id,
        reportDate: {
          $gte: today,
          $lt: tomorrow,
        },
      })
        .populate('userId', 'name email role')
        .lean(),
      getTasksWithStatusChangesToday(user.id)
    ])

    if (!report) {
      // Return tasks with status changes for new report
      res.json({
        tasksWithStatusChanges: {
          completed: statusChanges.completed,
          inProgress: statusChanges.inProgress,
        },
        blockedTasks: [],
      })
      return
    }

    // Get associated tasks
    const eodTasks = await EODTask.find({ eodReportId: report._id })
      .populate({
        path: 'taskId',
        select: 'title status type priority projectId assigneeId',
        populate: {
          path: 'projectId',
          select: 'name'
        }
      })
      .lean()

    // Get all task IDs from EOD tasks
    const taskIds = eodTasks
      .map(et => {
        const taskId = typeof et.taskId === 'object' ? (et.taskId as any)?._id : et.taskId
        return taskId ? String(taskId) : null
      })
      .filter(Boolean) as string[]

    // Query tasks directly to check assigneeId
    const tasksWithAssignee = taskIds.length > 0
      ? await Task.find({ _id: { $in: taskIds } })
        .select('_id assigneeId')
        .lean()
      : []

    // Create a map of taskId -> assigneeId
    const taskAssigneeMap = new Map<string, string>()
    tasksWithAssignee.forEach(task => {
      const assigneeId = task.assigneeId ? String(task.assigneeId) : null
      if (assigneeId) {
        taskAssigneeMap.set(String(task._id), assigneeId)
      }
    })

    // Filter EOD tasks to only include those assigned to the current user
    // This prevents showing other users' tasks in completed/in-progress sections
    const userAssignedEodTasks = eodTasks.filter(et => {
      const taskId = typeof et.taskId === 'object' ? (et.taskId as any)?._id : et.taskId
      if (!taskId) return false
      const taskIdStr = String(taskId)
      const assigneeId = taskAssigneeMap.get(taskIdStr)
      // Only include tasks assigned to the current user
      return assigneeId && String(assigneeId) === String(user.id)
    })

    // Get blocked tasks (stored as array of task IDs in report)
    // Also filter to only show tasks assigned to the user
    const blockedTaskIds = (report as any).blockedTasks || []
    const allBlockedTasks = blockedTaskIds.length > 0
      ? await Task.find({ 
          _id: { $in: blockedTaskIds },
          assigneeId: user.id  // Only get tasks assigned to current user
        })
        .populate('projectId', 'name')
        .select('_id title status type priority projectId assigneeId')
        .lean()
      : []
    
    // Blocked tasks are already filtered by assigneeId in the query above
    const blockedTasks = allBlockedTasks

    // Calculate editability
    const editable = isReportEditable(report)
    const now = new Date()
    const endOfDay = new Date(now)
    endOfDay.setHours(23, 59, 59, 999)
    const timeUntilEndOfDay = endOfDay.getTime() - now.getTime()
    const hoursUntilEndOfDay = Math.floor(timeUntilEndOfDay / (1000 * 60 * 60))
    const minutesUntilEndOfDay = Math.floor((timeUntilEndOfDay % (1000 * 60 * 60)) / (1000 * 60))

    const response = {
      ...report,
      // Only return tasks assigned to the user
      tasks: userAssignedEodTasks.map(et => ({
        taskId: et.taskId,
        status: et.status,
        progress: et.progress,
        task: typeof et.taskId === 'object' ? et.taskId : null,
      })),
      // Only return blocked tasks assigned to the user
      blockedTasks,
      tasksWithStatusChanges: {
        completed: statusChanges.completed,
        inProgress: statusChanges.inProgress,
      },
      editable,
      timeUntilEndOfDay: editable && report.status === EODStatus.SUBMITTED ? {
        hours: hoursUntilEndOfDay,
        minutes: minutesUntilEndOfDay,
        totalMs: timeUntilEndOfDay,
      } : null,
    }

    res.json(response)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

/**
 * Helper function to get accessible task IDs for a developer
 * Returns task IDs that are either:
 * - Assigned to the developer
 * - In projects where the developer is a member
 */
async function getAccessibleTaskIds(userId: string): Promise<string[]> {
  // Get tasks assigned to the developer
  const assignedTasks = await Task.find({ assigneeId: userId }).select('_id')
  const assignedTaskIds = assignedTasks.map(t => t._id)

  // Get projects where developer is a member
  const memberProjects = await ProjectMember.find({ userId }).select('projectId')
  const projectIds = memberProjects.map(m => m.projectId)

  // Get tasks in those projects
  const projectTasks = await Task.find({ projectId: { $in: projectIds } }).select('_id')
  const projectTaskIds = projectTasks.map(t => t._id)

  // Combine and deduplicate
  const allTaskIds = [...new Set([...assignedTaskIds, ...projectTaskIds])]
  return allTaskIds
}

/**
 * Get tasks with DONE or IN_PROGRESS status for a developer
 * Returns tasks assigned to developer OR in their projects with current status DONE or IN_PROGRESS
 * This shows all relevant tasks regardless of when they were updated
 */
async function getTasksWithStatusChangesToday(userId: string): Promise<{
  completed: any[]
  inProgress: any[]
}> {
  try {
    // ONLY fetch tasks assigned to the user - not all tasks from their projects
    // This prevents showing other users' tasks in the EOD form
    const [completedTasks, inProgressTasks] = await Promise.all([
      // Completed tasks query - ONLY tasks assigned to user
      Task.find({
        assigneeId: userId,
        status: TaskStatus.DONE
      })
        .select('_id title status type priority projectId assigneeId')
        .populate('projectId', 'name')
        .limit(50)
        .lean(),
      // In-progress tasks query - ONLY tasks assigned to user
      Task.find({
        assigneeId: userId,
        status: TaskStatus.IN_PROGRESS
      })
        .select('_id title status type priority projectId assigneeId')
        .populate('projectId', 'name')
        .limit(50)
        .lean()
    ])

    // Populate project names only for tasks that need it
    const completed = completedTasks.map(t => ({
      _id: t._id,
      title: t.title,
      status: t.status,
      type: t.type,
      priority: t.priority,
      projectId: t.projectId
    }))

    const inProgress = inProgressTasks.map(t => ({
      _id: t._id,
      title: t.title,
      status: t.status,
      type: t.type,
      priority: t.priority,
      projectId: t.projectId
    }))

    return { completed, inProgress }
  } catch (error: any) {
    console.error('[getTasksWithStatusChangesToday] Error:', error)
    return { completed: [], inProgress: [] }
  }
}

/**
 * Create or update today's EOD report (draft)
 * Only developers can create/update their own reports
 * Can only create/update for today
 */
export const createOrUpdateEODReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user
    if (!user) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }

    if (user.role !== UserRole.DEVELOPER) {
      res.status(403).json({ message: 'Only developers can create EOD reports' })
      return
    }

    const data = createEODReportSchema.parse(req.body)

    // Parse report date or use today
    const reportDate = data.reportDate ? new Date(data.reportDate) : new Date()
    reportDate.setHours(0, 0, 0, 0)

    // Check if it's today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (reportDate.getTime() !== today.getTime()) {
      res.status(400).json({ message: 'You can only create/update EOD reports for today' })
      return
    }

    // Get accessible task IDs for validation
    const accessibleTaskIds = await getAccessibleTaskIds(user.id)

    // Validate that all tasks in completedTasks and inProgressTasks are accessible
    const allTaskIds = [
      ...(data.completedTasks || []).map(t => t.taskId),
      ...(data.inProgressTasks || []).map(t => t.taskId),
    ]

    const invalidTaskIds = allTaskIds.filter(taskId => !accessibleTaskIds.includes(taskId))
    if (invalidTaskIds.length > 0) {
      res.status(403).json({
        message: `You do not have access to the following tasks: ${invalidTaskIds.join(', ')}`
      })
      return
    }

    // Check if report already exists
    const existingReport = await EODReport.findOne({
      userId: user.id,
      reportDate: reportDate,
    })

    // Check if report is final (cannot edit after end of day)
    if (existingReport && existingReport.isFinal) {
      res.status(400).json({ message: 'Cannot modify final EOD report. The edit window has closed.' })
      return
    }

    let reportId: string
    let report: any

    if (existingReport) {
      // Update existing draft
      reportId = existingReport._id
      const updateData = updateEODReportSchema.parse(req.body)

      // Update report fields
      if (updateData.blockersText !== undefined) existingReport.blockersText = updateData.blockersText
      if (data.blockedTasks !== undefined) (existingReport as any).blockedTasks = data.blockedTasks || []
      if (updateData.planForTomorrow !== undefined) existingReport.planForTomorrow = updateData.planForTomorrow
      if (updateData.notes !== undefined) existingReport.notes = updateData.notes

      // Calculate counts from tasks (if provided)
      if (updateData.completedTasks !== undefined || updateData.inProgressTasks !== undefined) {
        const completedCount = updateData.completedTasks?.length || data.completedTasks?.length || 0
        const inProgressCount = updateData.inProgressTasks?.length || data.inProgressTasks?.length || 0
        existingReport.tasksCompleted = completedCount
        existingReport.tasksInProgress = inProgressCount
        existingReport.blockers = updateData.blockersText ? 1 : 0
      } else {
        // Use legacy fields if provided
        if (updateData.tasksCompleted !== undefined) existingReport.tasksCompleted = updateData.tasksCompleted
        if (updateData.tasksInProgress !== undefined) existingReport.tasksInProgress = updateData.tasksInProgress
        if (updateData.blockers !== undefined) existingReport.blockers = updateData.blockers
      }

      await existingReport.save()
      report = existingReport
    } else {
      // Create new draft
      reportId = generateId()

      // Calculate counts from tasks
      const completedCount = data.completedTasks?.length || data.tasksCompleted || 0
      const inProgressCount = data.inProgressTasks?.length || data.tasksInProgress || 0
      const blockersCount = data.blockersText ? 1 : (data.blockers || 0)

      report = new EODReport({
        _id: reportId,
        userId: user.id,
        reportDate: reportDate,
        tasksCompleted: completedCount,
        tasksInProgress: inProgressCount,
        blockers: blockersCount,
        blockersText: data.blockersText,
        blockedTasks: data.blockedTasks || [],
        planForTomorrow: data.planForTomorrow,
        notes: data.notes,
        status: EODStatus.DRAFT,
      })

      await report.save()
    }

    // Handle task associations
    if (data.completedTasks || data.inProgressTasks) {
      // Delete existing EODTask records for this report
      await EODTask.deleteMany({ eodReportId: reportId })

      // Create new EODTask records
      const eodTasksToCreate: any[] = []

      // Add completed tasks
      if (data.completedTasks && data.completedTasks.length > 0) {
        for (const task of data.completedTasks) {
          eodTasksToCreate.push({
            _id: generateId(),
            eodReportId: reportId,
            taskId: task.taskId,
            status: EODTaskStatus.COMPLETED,
            progress: 100,
          })
        }
      }

      // Add in-progress tasks
      if (data.inProgressTasks && data.inProgressTasks.length > 0) {
        for (const task of data.inProgressTasks) {
          eodTasksToCreate.push({
            _id: generateId(),
            eodReportId: reportId,
            taskId: task.taskId,
            status: EODTaskStatus.IN_PROGRESS,
            progress: task.progress || 0,
          })
        }
      }

      // Bulk insert EODTask records
      if (eodTasksToCreate.length > 0) {
        await EODTask.insertMany(eodTasksToCreate)
      }
    }

    // Fetch and return the complete report with tasks
    const result = await EODReport.findById(reportId)
      .populate('userId', 'name email role')
      .lean()

    // Get associated tasks
    const eodTasks = await EODTask.find({ eodReportId: reportId })
      .populate('taskId', 'title status type priority')
      .lean()

    const response = {
      ...result,
      tasks: eodTasks.map(et => ({
        taskId: et.taskId,
        status: et.status,
        progress: et.progress,
        task: typeof et.taskId === 'object' ? et.taskId : null,
      })),
    }

    res.json(response)
  } catch (error: any) {
    console.error('Error creating/updating EOD report:', error)
    res.status(400).json({ message: error.message })
  }
}

/**
 * Submit EOD report
 * Only developers can submit their own reports
 * Can only submit for today
 * Once submitted, cannot be edited
 */
export const submitEODReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    console.log(`[submitEODReport] ===== SUBMIT REQUEST RECEIVED =====`)
    const user = req.user
    if (!user) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }

    if (user.role !== UserRole.DEVELOPER) {
      res.status(403).json({ message: 'Only developers can submit EOD reports' })
      return
    }

    // DEBUG: Write payload to file for inspection
    try {
      const fs = await import('fs')
      const debugLog = `\n\n[${new Date().toISOString()}] User: ${user.name} (${user.id})\nBody keys: ${Object.keys(req.body)}\ncompletedTasks: ${JSON.stringify(req.body.completedTasks)}\ninProgressTasks: ${JSON.stringify(req.body.inProgressTasks)}\n`
      fs.appendFileSync('submit_debug.log', debugLog)
    } catch (e) { console.error('Failed to write debug log', e) }

    console.log(`[submitEODReport] User: ${user.id} (${user.name}), Role: ${user.role}`)
    console.log(`[submitEODReport] Raw request body:`, JSON.stringify(req.body, null, 2))
    console.log(`[submitEODReport] Request body keys:`, Object.keys(req.body || {}))
    console.log(`[submitEODReport] completedTasks in body:`, req.body?.completedTasks)
    console.log(`[submitEODReport] inProgressTasks in body:`, req.body?.inProgressTasks)

    const data = submitEODReportSchema.parse(req.body)
    console.log(`[submitEODReport] Parsed data:`, {
      completedTasks: data.completedTasks,
      inProgressTasks: data.inProgressTasks,
      completedTasksLength: data.completedTasks?.length || 0,
      inProgressTasksLength: data.inProgressTasks?.length || 0,
      blockedTasks: data.blockedTasks?.length || 0,
      hasBlockersText: !!data.blockersText,
      hasPlanForTomorrow: !!data.planForTomorrow,
      hasNotes: !!data.notes,
      submitNow: data.submitNow,
      scheduledSubmitAt: data.scheduledSubmitAt
    })

    // Parse report date or use today
    const reportDate = data.reportDate ? new Date(data.reportDate) : new Date()
    reportDate.setHours(0, 0, 0, 0)

    // Check if it's today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (reportDate.getTime() !== today.getTime()) {
      res.status(400).json({ message: 'You can only submit EOD reports for today' })
      return
    }

    let report = await EODReport.findOne({
      userId: user.id,
      reportDate: reportDate,
    })

    // If report doesn't exist, create a new DRAFT report
    if (!report) {
      report = new EODReport({
        _id: generateId(),
        userId: user.id,
        reportDate: reportDate,
        status: EODStatus.DRAFT,
        tasksCompleted: 0,
        tasksInProgress: 0,
        blockers: 0,
        isFinal: false,
      })
      await report.save()
      console.log(`[submitEODReport] Created new DRAFT report ${report._id} for user ${user.id}`)
    }

    // Check if report is final (cannot modify after end of day)
    if (report.isFinal) {
      res.status(400).json({ message: 'EOD report is final and cannot be modified' })
      return
    }

    // If tasks are provided in the submit request, update them first
    // This allows resubmission with updated tasks
    console.log(`[submitEODReport] Checking for tasks to process...`)
    console.log(`[submitEODReport] completedTasks:`, data.completedTasks)
    console.log(`[submitEODReport] inProgressTasks:`, data.inProgressTasks)

    if (data.completedTasks || data.inProgressTasks) {
      console.log(`[submitEODReport] Processing tasks - completed: ${data.completedTasks?.length || 0}, inProgress: ${data.inProgressTasks?.length || 0}`)
      // Get accessible task IDs for validation
      const accessibleTaskIds = await getAccessibleTaskIds(user.id)

      // Validate that all tasks are accessible
      const allTaskIds = [
        ...(data.completedTasks || []).map(t => t.taskId),
        ...(data.inProgressTasks || []).map(t => t.taskId),
      ]

      const invalidTaskIds = allTaskIds.filter(taskId => !accessibleTaskIds.includes(taskId))
      if (invalidTaskIds.length > 0) {
        res.status(403).json({
          message: `You do not have access to the following tasks: ${invalidTaskIds.join(', ')}`
        })
        return
      }

      // Delete existing EODTask records for this report
      await EODTask.deleteMany({ eodReportId: report._id })

      // Create new EODTask records
      const eodTasksToCreate: any[] = []

      // Add completed tasks
      if (data.completedTasks && data.completedTasks.length > 0) {
        for (const task of data.completedTasks as any[]) {
          // Handle taskId - could be string or object
          let taskId: string
          if (typeof task.taskId === 'object' && task.taskId !== null) {
            const taskIdObj = task.taskId as any
            taskId = taskIdObj._id || taskIdObj.taskId || String(task.taskId)
          } else {
            taskId = String(task.taskId)
          }

          eodTasksToCreate.push({
            _id: generateId(),
            eodReportId: report._id,
            taskId: taskId,
            status: EODTaskStatus.COMPLETED,
            progress: 100,
          })
        }
      }

      // Add in-progress tasks
      if (data.inProgressTasks && data.inProgressTasks.length > 0) {
        for (const task of data.inProgressTasks as any[]) {
          // Handle taskId - could be string or object
          let taskId: string
          if (typeof task.taskId === 'object' && task.taskId !== null) {
            const taskIdObj = task.taskId as any
            taskId = taskIdObj._id || taskIdObj.taskId || String(task.taskId)
          } else {
            taskId = String(task.taskId)
          }

          eodTasksToCreate.push({
            _id: generateId(),
            eodReportId: report._id,
            taskId: taskId,
            status: EODTaskStatus.IN_PROGRESS,
            progress: task.progress || 0,
          })
        }
      }

      // Bulk insert EODTask records
      if (eodTasksToCreate.length > 0) {
        console.log(`[submitEODReport] Creating ${eodTasksToCreate.length} EODTask records:`, eodTasksToCreate.map(t => ({
          taskId: t.taskId,
          status: t.status,
          progress: t.progress
        })))
        await EODTask.insertMany(eodTasksToCreate)
        console.log(`[submitEODReport] Successfully inserted ${eodTasksToCreate.length} EODTask records`)
      } else {
        console.log(`[submitEODReport] No EODTask records to create (completedTasks: ${data.completedTasks?.length || 0}, inProgressTasks: ${data.inProgressTasks?.length || 0})`)
      }

      // Update report counts
      report.tasksCompleted = data.completedTasks?.length || 0
      report.tasksInProgress = data.inProgressTasks?.length || 0

      // Update other fields if provided
      if (data.blockersText !== undefined) report.blockersText = data.blockersText
      if (data.blockedTasks !== undefined) (report as any).blockedTasks = data.blockedTasks || []
      if (data.planForTomorrow !== undefined) report.planForTomorrow = data.planForTomorrow
      if (data.notes !== undefined) report.notes = data.notes

      console.log(`[submitEODReport] Updated tasks for report ${report._id}:`, {
        completed: data.completedTasks?.length || 0,
        inProgress: data.inProgressTasks?.length || 0,
        completedTaskIds: (data.completedTasks || []).map((t: any) => {
          const taskId = typeof t.taskId === 'object' ? (t.taskId as any)?._id || (t.taskId as any)?.taskId : t.taskId
          return taskId
        }),
        inProgressTaskIds: (data.inProgressTasks || []).map((t: any) => {
          const taskId = typeof t.taskId === 'object' ? (t.taskId as any)?._id || (t.taskId as any)?.taskId : t.taskId
          return taskId
        }),
        eodTasksCreated: eodTasksToCreate.length,
        rawCompletedTasks: data.completedTasks,
        rawInProgressTasks: data.inProgressTasks
      })

      // Verify tasks were saved
      const verifyTasks = await EODTask.find({ eodReportId: report._id }).lean()
      console.log(`[submitEODReport] Verification - EODTask records after update:`, verifyTasks.length, verifyTasks.map(t => ({
        taskId: t.taskId,
        taskIdType: typeof t.taskId,
        status: t.status,
        progress: t.progress
      })))
    } else {
      console.log(`[submitEODReport] No tasks provided in request (completedTasks: ${(data.completedTasks || []).length}, inProgressTasks: ${(data.inProgressTasks || []).length})`)
    }

    // Handle scheduled submission or immediate submission
    console.log(`[submitEODReport] Handling submission - submitNow: ${data.submitNow}, scheduledSubmitAt: ${data.scheduledSubmitAt}`)
    const submitNow = data.submitNow !== false // Default to true if not specified

    if (submitNow) {
      // Immediate submission
      report.status = EODStatus.SUBMITTED
      report.submittedAt = new Date()
      report.scheduledSubmitAt = undefined // Clear any scheduled time
    } else {
      // Scheduled submission
      if (!data.scheduledSubmitAt) {
        res.status(400).json({ message: 'scheduledSubmitAt is required when submitNow is false' })
        return
      }

      const scheduledTime = new Date(data.scheduledSubmitAt)
      const now = new Date()

      if (scheduledTime <= now) {
        res.status(400).json({ message: 'Scheduled submission time must be in the future' })
        return
      }

      // Check if scheduled time is today (must be before end of day)
      const today = new Date()
      today.setHours(23, 59, 59, 999)

      if (scheduledTime > today) {
        res.status(400).json({ message: 'Scheduled submission must be before end of day (11:59 PM)' })
        return
      }

      report.scheduledSubmitAt = scheduledTime
      // Status remains DRAFT until scheduled time
    }

    await report.save()
    console.log(`[submitEODReport] Report saved - ID: ${report._id}, Status: ${report.status}, Completed: ${report.tasksCompleted}, InProgress: ${report.tasksInProgress}`)

    const submitted = await EODReport.findById(report._id)
      .populate('userId', 'name email role')
      .lean()

    // Get associated tasks
    const eodTasks = await EODTask.find({ eodReportId: report._id })
      .populate('taskId', 'title status type priority')
      .lean()

    console.log(`[submitEODReport] Final EODTask count: ${eodTasks.length}`)
    if (eodTasks.length > 0) {
      console.log(`[submitEODReport] Final tasks:`, eodTasks.map((et: any) => ({
        taskId: typeof et.taskId === 'object' ? (et.taskId as any)?._id : et.taskId,
        status: et.status,
        progress: et.progress
      })))
    }

    const response = {
      ...submitted,
      tasks: eodTasks.map(et => ({
        taskId: et.taskId,
        status: et.status,
        progress: et.progress,
        task: typeof et.taskId === 'object' ? et.taskId : null,
      })),
    }

    console.log(`[submitEODReport] ===== SUBMIT COMPLETE =====`)
    res.json(response)
  } catch (error: any) {
    console.error(`[submitEODReport] ===== ERROR =====`, error)
    res.status(400).json({ message: error.message })
  }
}

/**
 * Get EOD reports summary for managers (Group Head / Admin)
 * Returns summary view with counts, can drill down to see task details
 */

/**
 * Get EOD reports summary for managers (Group Head / Admin)
 * Returns summary view with counts, can drill down to see task details
 */
export const getEODReportsSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user
    if (!user) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }

    // Only Group Head and Manager can access this
    if (user.role !== UserRole.GROUP_HEAD && user.role !== UserRole.MANAGER) {
      res.status(403).json({ message: 'Only Group Heads and Managers can view EOD summaries' })
      return
    }

    const query = eodReportQuerySchema.parse(req.query)
    const { userId, startDate, endDate } = query

    // Build date filter
    const dateFilter: any = {}
    if (startDate || endDate) {
      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        dateFilter.$gte = start
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999) // Include entire end date
        dateFilter.$lte = end
      }
    } else {
      // Default to today if no date range specified
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      dateFilter.$gte = today
      dateFilter.$lt = tomorrow
    }

    // Build user filter
    const userFilter: any = {}
    if (userId) {
      userFilter.userId = userId
    }

    // Get all EOD reports for the date range
    const reports = await EODReport.find({
      ...userFilter,
      reportDate: dateFilter,
      $or: [
        { status: EODStatus.SUBMITTED }, // Submitted reports
        {
          status: EODStatus.DRAFT,
          scheduledSubmitAt: { $exists: true, $ne: null } // Scheduled reports (DRAFT with scheduled time)
        }
      ]
    })
      .populate('userId', 'name email role')
      .sort({ reportDate: -1, userId: 1 })
      .lean()

    // Group by user and date
    const summary: Record<string, any> = {}

    for (const report of reports) {
      const user = typeof report.userId === 'object' ? report.userId : null
      const userIdStr = typeof report.userId === 'object' ? String((report.userId as any)._id) : String(report.userId)
      const userName = (user as any)?.name || userIdStr
      const reportDate = new Date(report.reportDate).toISOString().split('T')[0]
      const key = `${userIdStr}_${reportDate}`

      // Update summary if this report is newer or first found
      // Note: we sorted by reportDate -1, so first found is latest? No, sorting by date not submittedAt
      // But for same day, we want the "latest" version.

      const updateSummary = () => {
        const isScheduled = report.status === EODStatus.DRAFT && report.scheduledSubmitAt

        summary[key] = {
          ...summary[key], // Keep existing if merging (but we overwrite mostly)
          userId: userIdStr,
          userName,
          userEmail: (user as any)?.email,
          reportDate,
          reportId: report._id,
          completed: 0,
          inProgress: 0,
          blockers: 0,
          hasBlockers: !!report.blockersText,
          blockersText: report.blockersText,
          planForTomorrow: report.planForTomorrow,
          notes: report.notes,
          submittedAt: report.submittedAt,
          scheduledSubmitAt: report.scheduledSubmitAt,
          isScheduled: isScheduled || false,
          status: report.status,
          tasks: {
            completed: [],
            inProgress: [],
            blocked: [],
          },
        }
      }

      if (!summary[key]) {
        updateSummary()
      } else {
        const existingSubmittedAt = summary[key].submittedAt ? new Date(summary[key].submittedAt).getTime() : 0
        const currentSubmittedAt = report.submittedAt ? new Date(report.submittedAt).getTime() : 0
        const existingUpdatedAt = report.updatedAt ? new Date(report.updatedAt).getTime() : 0

        // Use the latest report (prefer submittedAt, fallback to updatedAt)
        if (currentSubmittedAt > existingSubmittedAt ||
          (currentSubmittedAt === existingSubmittedAt && existingUpdatedAt > existingSubmittedAt)) {
          updateSummary()
        }
      }
    }

    // Now process tasks for each summary entry using the latest reportId
    for (const key in summary) {
      const reportIdToUse = summary[key].reportId

      // Fetch the report data first to get blockedTasks and other fields
      const reportData = await EODReport.findById(reportIdToUse).lean()

      // Get EODTasks - ensure we query by string if IDs are strings
      const eodTasks = await EODTask.find({ eodReportId: reportIdToUse })
        .populate({
          path: 'taskId',
          select: 'title status type priority projectId',
          model: 'Task',
          strictPopulate: false,
          populate: {
            path: 'projectId',
            select: 'name',
            model: 'Project',
            strictPopulate: false
          }
        })
        .lean()

      // Process tasks
      summary[key].tasks.completed = []
      summary[key].tasks.inProgress = []

      for (const et of eodTasks) {
        // Resolve task details
        // et.taskId can be the populated object OR the original string if populate failed
        let taskData: any = null
        let taskIdStr: string = ''

        if (typeof et.taskId === 'object' && et.taskId !== null) {
          taskData = et.taskId
          taskIdStr = String((et.taskId as any)._id || (et.taskId as any).id)
        } else {
          taskIdStr = String(et.taskId)
        }

        // If populate failed or we just have string, try to look up generic info?
        // We rely on populate. If missing, we show ID.
        if (!taskData && taskIdStr) {
          // Double check if we can fetch it (maybe it wasn't populated due to some reason)
          try {
            const t = await Task.findById(taskIdStr)
              .select('title status type priority projectId')
              .populate('projectId', 'name')
              .lean()
            if (t) taskData = t
          } catch (e) { /* ignore */ }
        }

        // Get project name
        let projectName = 'No Project'
        if (taskData?.projectId) {
          if (typeof taskData.projectId === 'object' && taskData.projectId !== null) {
            projectName = (taskData.projectId as any).name || 'No Project'
          } else {
            // If projectId is just a string, try to fetch project name
            try {
              const project = await Project.findById(taskData.projectId).select('name').lean()
              if (project) projectName = (project as any).name
            } catch (e) { /* ignore */ }
          }
        }

        const taskItem = {
          taskId: taskIdStr,
          title: taskData?.title || `Task ${taskIdStr}`,
          type: taskData?.type || 'TASK',
          priority: taskData?.priority || 'MEDIUM',
          progress: et.progress || 0,
          projectName: projectName
        }

        if (et.status === EODTaskStatus.COMPLETED) {
          summary[key].tasks.completed.push(taskItem)
        } else if (et.status === EODTaskStatus.IN_PROGRESS) {
          summary[key].tasks.inProgress.push(taskItem)
        }
      }

      // Get blocked tasks
      const blockedTaskIds = (reportData as any)?.blockedTasks || []
      if (blockedTaskIds.length > 0) {
        const blockedTasks = await Task.find({ _id: { $in: blockedTaskIds } })
          .populate('projectId', 'name')
          .select('_id title status type priority projectId')
          .lean()

        summary[key].tasks.blocked = blockedTasks.map(t => ({
          taskId: t._id,
          title: t.title,
          type: t.type,
          priority: t.priority,
          projectName: typeof t.projectId === 'object' ? (t.projectId as any)?.name : null,
        }))
      } else {
        summary[key].tasks.blocked = []
      }

      // Update counts based on ACTUAL tasks found
      summary[key].completed = summary[key].tasks.completed.length
      summary[key].inProgress = summary[key].tasks.inProgress.length
      summary[key].blockers = summary[key].tasks.blocked.length || (reportData as any)?.blockers || 0
    }

    const summaryArray = Object.values(summary)

    res.json({
      data: summaryArray,
      total: summaryArray.length,
    })
  } catch (error: any) {
    console.error('Error getting EOD summary:', error)
    res.status(400).json({ message: error.message })
  }
}
