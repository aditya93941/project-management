import { Response } from 'express'
import { Task, User, Project, Notification } from '../models'
import { generateId } from '../utils/generateId'
import { createTaskSchema, updateTaskSchema, taskParamsSchema } from '../schemas'
import { AuthRequest } from '../middleware/auth.middleware'
import { canAssignTaskToUser } from '../utils/permissionChecker'
import { getAccessibleProjectIds, hasProjectAccess } from '../utils/projectAccess'
import { UserRole } from '../models/User.model'
import { updateProjectProgress, updateProjectStatus } from '../utils/calculateProjectProgress'
import { logger } from '../utils/logger'
import { ProjectStatus, TaskStatus } from '../types'
import { markUserViewingTask } from '../utils/taskViewingTracker'

export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!
    const userRole = req.user?.role as UserRole

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit

    const filter: any = {}
    if (req.query.assigneeId) filter.assigneeId = req.query.assigneeId
    if (req.query.status) filter.status = req.query.status
    if (req.query.type) filter.type = req.query.type
    if (req.query.priority) filter.priority = req.query.priority

    // Apply project access control
    // If projectId is specified, verify access to that project
    if (req.query.projectId) {
      const projectId = req.query.projectId as string
      
      // Check access to the specific project
      let hasAccess = false
      if (userRole === UserRole.MANAGER || userRole === UserRole.GROUP_HEAD) {
        hasAccess = true
      } else if (userRole === UserRole.TEAM_LEAD) {
        const { Project, ProjectMember } = await import('../models')
        const project = await Project.findOne({ _id: projectId })
        const membership = await ProjectMember.findOne({ projectId, userId })
        hasAccess = !!membership || project?.team_lead.toString() === userId
      } else {
        const accessCheck = await hasProjectAccess(userId, userRole, projectId)
        hasAccess = accessCheck.hasAccess
      }

      if (!hasAccess) {
        res.status(403).json({ 
          message: 'You do not have access to tasks in this project.' 
        })
        return
      }

      filter.projectId = projectId
    } else {
      // No specific project - filter by accessible projects
      const accessibleProjectIds = await getAccessibleProjectIds(userId, userRole)
      
      if (accessibleProjectIds === null) {
        // Admin/Super Admin - can see all tasks (no filter)
      } else if (accessibleProjectIds.length === 0) {
        // No accessible projects - return empty
        res.json({
          data: [],
          total: 0,
          page,
          limit,
        })
        return
      } else {
        // Filter by accessible project IDs
        // For TEAM_LEAD, also include projects where they are team_lead
        if (userRole === UserRole.TEAM_LEAD) {
          const { Project } = await import('../models')
          const teamLeadProjectIds = await Project.find({ team_lead: userId }).distinct('_id')
          const allAccessibleIds = [
            ...accessibleProjectIds,
            ...teamLeadProjectIds.map(id => id.toString())
          ]
          const uniqueIds = [...new Set(allAccessibleIds)]
          filter.projectId = { $in: uniqueIds }
        } else {
          filter.projectId = { $in: accessibleProjectIds }
        }
      }
    }

    const tasks = await Task.find(filter)
      .populate('projectId', 'name')
      .populate('assigneeId', 'name email image')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })

    const total = await Task.countDocuments(filter)

    res.json({
      data: tasks,
      total,
      page,
      limit,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export const getTaskById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = taskParamsSchema.parse(req.params)
    const userId = req.userId!
    const userRole = req.user?.role as UserRole

    // First get the task without population to get the raw projectId
    const taskRaw = await Task.findById(id).lean()
    if (!taskRaw) {
      res.status(404).json({ message: 'Task not found' })
      return
    }

    // Get projectId from raw document (before population)
    const projectId = String(taskRaw.projectId)

    // Now get the task with population for the response
    const task = await Task.findById(id)
      .populate('projectId', 'name description')
      .populate('assigneeId', 'name email image')
    if (!task) {
      res.status(404).json({ message: 'Task not found' })
      return
    }
    
    let hasAccess = false

    if (userRole === UserRole.MANAGER || userRole === UserRole.GROUP_HEAD) {
      hasAccess = true // Admins have full access
    } else if (userRole === UserRole.TEAM_LEAD) {
      const { Project, ProjectMember } = await import('../models')
      const project = await Project.findOne({ _id: projectId })
      const membership = await ProjectMember.findOne({ projectId, userId })
      hasAccess = !!membership || project?.team_lead.toString() === userId
    } else {
      const accessCheck = await hasProjectAccess(userId, userRole, projectId)
      hasAccess = accessCheck.hasAccess
    }

    if (!hasAccess) {
      res.status(403).json({ 
        message: 'You do not have access to this task. You must be a member of the project to view it.' 
      })
      return
    }

    const comments = await import('../models').then((m) =>
      m.Comment.find({ taskId: id }).populate('userId', 'name email image').sort({ createdAt: -1 })
    )

    res.json({
      ...task.toObject(),
      comments,
    })
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = createTaskSchema.parse(req.body)
    
    // Check permission to assign task if assigneeId is provided
    if (data.assigneeId && data.assigneeId !== req.user?.id) {
      const targetUser = await User.findById(data.assigneeId)
      if (!targetUser) {
        res.status(404).json({ message: 'Target user not found' })
        return
      }

      const permissionCheck = await canAssignTaskToUser(
        req.user?.id!,
        req.user?.role!,
        data.assigneeId,
        data.projectId,
        targetUser.role
      )

      if (!permissionCheck.canAssign) {
        res.status(403).json({ message: permissionCheck.reason || 'Insufficient permissions' })
        return
      }
    }

    const taskId = generateId()
    const task = new Task({
      _id: taskId,
      ...data,
      createdById: req.user?.id,
    })
    await task.save()
    const populated = await Task.findById(taskId)
      .populate('projectId', 'name')
      .populate('assigneeId', 'name email image')

    // Create Notification if assignee exists
    if (data.assigneeId && data.assigneeId !== req.user?.id) {
      try {
        const { Notification } = await import('../models')
        await Notification.create({
          _id: generateId(),
          recipientId: data.assigneeId,
          senderId: req.user?.id,
          taskId: taskId,
          message: `You have been assigned to task "${data.title}"`,
          type: 'TASK_ASSIGN',
          relatedId: taskId,
        })
      } catch (err) {
        logger.error('Failed to create notification', err)
      }
    }

    // Check and update project status if needed (reactivate if completed/cancelled)
    try {
      const project = await Project.findById(data.projectId)
      if (project && (project.status === ProjectStatus.COMPLETED || project.status === ProjectStatus.CANCELLED)) {
        // New task added to completed/cancelled project - reactivate it
        await Project.findByIdAndUpdate(data.projectId, { 
          status: ProjectStatus.ACTIVE 
        })
        logger.log(`[createTask] Reactivated project ${data.projectId} - new task added`)
      }
    } catch (err) {
      logger.error('Failed to update project status:', err)
    }

    // Update project progress after task creation
    await updateProjectProgress(data.projectId).catch(err => {
      logger.error('Failed to update project progress:', err)
    })

    res.status(201).json(populated)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = taskParamsSchema.parse(req.params)
    const data = updateTaskSchema.parse(req.body)
    const userRole = req.user?.role as UserRole
    
    const existingTask = await Task.findById(id)
    if (!existingTask) {
      res.status(404).json({ message: 'Task not found' })
      return
    }

    // Super Admin (MANAGER) and Group Admin (GROUP_HEAD) can edit any task
    const isSuperAdmin = userRole === UserRole.MANAGER
    const isGroupAdmin = userRole === UserRole.GROUP_HEAD
    
    // RBAC: Super Admin/Group Admin can edit all. Creator can edit all. Assignee can only edit status. Others cannot edit.
    const isCreator = existingTask.createdById === req.user?.id
    const isAssignee = existingTask.assigneeId === req.user?.id

    // Allow Super Admin and Group Admin to edit any task
    if (!isSuperAdmin && !isGroupAdmin && !isCreator && !isAssignee) {
      res.status(403).json({ message: 'You are not authorized to edit this task' })
      return
    }

    // Check permission if assigneeId is being updated
    if (data.assigneeId && data.assigneeId !== existingTask.assigneeId) {
      const targetUser = await User.findById(data.assigneeId)
      if (!targetUser) {
        res.status(404).json({ message: 'Target user not found' })
        return
      }

      const permissionCheck = await canAssignTaskToUser(
        req.user?.id!,
        req.user?.role!,
        data.assigneeId,
        existingTask.projectId,
        targetUser.role
      )

      if (!permissionCheck.canAssign) {
        res.status(403).json({ message: permissionCheck.reason || 'Insufficient permissions' })
        return
      }
    }

    // Restrict assignee edits (unless they're also creator, super admin, or group admin)
    if (isAssignee && !isCreator && !isSuperAdmin && !isGroupAdmin) {
      // Assignee can ONLY update status
      // Check if any other field is present in body
      const allowedUpdates = ['status']
      const updates = Object.keys(data)
      const hasForbiddenUpdates = updates.some(u => !allowedUpdates.includes(u))

      if (hasForbiddenUpdates) {
        res.status(403).json({ message: 'Assignees can only update task status' })
        return
      }
    }

    const oldStatus = existingTask.status
    const task = await Task.findByIdAndUpdate(id, data, { new: true })
      .populate('projectId', 'name')
      .populate('assigneeId', 'name email image')

    // Update project progress after task update (status change affects progress)
    if (task && data.status !== undefined) {
      const projectIdToUpdate = existingTask.projectId.toString()
      await updateProjectProgress(projectIdToUpdate).catch(err => {
        logger.error('Failed to update project progress:', err)
      })
      
      // Update project status (auto-complete if all tasks done, reactivate if incomplete)
      await updateProjectStatus(projectIdToUpdate).catch(err => {
        logger.error('Failed to update project status:', err)
      })
      
      // Send notification for status change
      if (data.status !== oldStatus && task) {
        try {
          const recipients = new Set<string>()
          
          // Notify task creator
          if (existingTask.createdById && existingTask.createdById !== req.user?.id) {
            recipients.add(existingTask.createdById.toString())
          }
          
          // Notify task assignee
          if (existingTask.assigneeId && existingTask.assigneeId !== req.user?.id) {
            recipients.add(existingTask.assigneeId.toString())
          }
          
          // Notify project team lead
          const project = await Project.findById(projectIdToUpdate).select('team_lead')
          if (project?.team_lead && project.team_lead !== req.user?.id) {
            recipients.add(project.team_lead.toString())
          }
          
          // Create notifications for all recipients
          for (const recipientId of recipients) {
            await Notification.create({
              _id: generateId(),
              recipientId,
              senderId: req.user?.id,
              taskId: task._id,
              message: `Task "${task.title || existingTask.title}" status changed from ${oldStatus} to ${data.status}`,
              type: 'TASK_STATUS_CHANGE',
              relatedId: task._id,
            })
          }
        } catch (err) {
          logger.error('Failed to create status change notification:', err)
        }
      }
    }

    res.json(task)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

/**
 * Mark user as viewing a task (for notification filtering)
 */
export const markTaskViewing = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = taskParamsSchema.parse(req.params)
    const userId = req.user?.id
    
    if (!userId) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }
    
    // Mark user as viewing this task
    markUserViewingTask(id, userId)
    
    res.json({ message: 'Viewing status updated' })
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = taskParamsSchema.parse(req.params)
    const task = await Task.findById(id)
    if (!task) {
      res.status(404).json({ message: 'Task not found' })
      return
    }
    
    const projectId = task.projectId.toString()
    await Task.findByIdAndDelete(id)
    await import('../models').then((m) => m.Comment.deleteMany({ taskId: id }))
    
    // Update project progress after task deletion
    await updateProjectProgress(projectId).catch(err => {
      logger.error('Failed to update project progress:', err)
    })
    
    // Update project status (might need to reactivate if it was completed)
    await updateProjectStatus(projectId).catch(err => {
      logger.error('Failed to update project status:', err)
    })
    
    res.json({ message: 'Task deleted successfully' })
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

