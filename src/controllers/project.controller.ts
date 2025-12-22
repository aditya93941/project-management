import { Response } from 'express'
import { Project, ProjectMember, User } from '../models'
import { generateId } from '../utils/generateId'
import {
  createProjectSchema,
  updateProjectSchema,
  projectParamsSchema,
  addProjectMemberSchema,
} from '../schemas'
import { AuthRequest } from '../middleware/auth.middleware'
import { hasProjectAccess, getAccessibleProjectIds } from '../utils/projectAccess'
import { UserRole } from '../models/User.model'
import { logger } from '../utils/logger'

export const getProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!
    const userRole = req.user?.role as UserRole

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const skip = (page - 1) * limit
    const includeTasks = req.query.includeTasks === 'true'
    const includeMembers = req.query.includeMembers === 'true'

    // Build filter based on user role and access
    const filter: any = {}
    if (req.query.status) filter.status = req.query.status
    if (req.query.priority) filter.priority = req.query.priority

    // Apply access control based on role
    if (userRole === UserRole.DEVELOPER) {
      // DEVELOPER: Only projects they are a member of
      const accessibleProjectIds = await getAccessibleProjectIds(userId, userRole)
      
      if (accessibleProjectIds === null || accessibleProjectIds.length === 0) {
        // No accessible projects
        res.json({
          data: [],
          total: 0,
          page,
          limit,
        })
        return
      }
      // Ensure all IDs are strings for proper matching
      // Convert to strings and remove any duplicates/empty values
      const normalizedProjectIds = accessibleProjectIds
        .map(id => String(id).trim())
        .filter(id => id && id.length > 0)
        .filter((id, index, arr) => arr.indexOf(id) === index) // Remove duplicates
      
      if (normalizedProjectIds.length === 0) {
        res.json({
          data: [],
          total: 0,
          page,
          limit,
        })
        return
      }
      
      filter._id = { $in: normalizedProjectIds }
    } else if (userRole === UserRole.TEAM_LEAD) {
      // TEAM_LEAD: Projects where they are team_lead OR a member
      const memberProjectIds = await getAccessibleProjectIds(userId, userRole)
      const teamLeadProjectIds = await Project.find({ team_lead: userId }).distinct('_id')
      
      // Combine member and team_lead project IDs
      const allAccessibleIds = [
        ...(memberProjectIds || []).map(id => String(id)),
        ...teamLeadProjectIds.map(id => String(id))
      ]
      
      // Remove duplicates
      const uniqueIds = [...new Set(allAccessibleIds)]
      
      if (uniqueIds.length === 0) {
        res.json({
          data: [],
          total: 0,
          page,
          limit,
        })
        return
      }
      filter._id = { $in: uniqueIds }
    }
    // MANAGER and GROUP_HEAD: No filter (can see all projects)

    const projects = await Project.find(filter)
      .populate('team_lead', 'name email image')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })

    const total = await Project.countDocuments(filter)

    // Optionally include members and tasks for each project
    const projectsWithRelations = await Promise.all(
      projects.map(async (project) => {
        const projectObj: any = project.toObject()

        if (includeMembers) {
          const members = await ProjectMember.find({ projectId: project._id })
            .populate('userId', 'name email image')
          projectObj.members = members
        }

        if (includeTasks) {
          const { Task } = await import('../models')
          const tasks = await Task.find({ projectId: project._id })
            .populate('assigneeId', 'name email image')
          projectObj.tasks = tasks
        }

        return projectObj
      })
    )

    res.json({
      data: projectsWithRelations,
      total,
      page,
      limit,
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export const getProjectById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = projectParamsSchema.parse(req.params)
    const userId = req.userId!
    const userRole = req.user?.role as UserRole

    // Use findOne with _id instead of findById for custom string IDs
    const project = await Project.findOne({ _id: id })
      .populate('team_lead', 'name email image')

    if (!project) {
      console.log('[getProjectById] Project not found with ID:', id)
      res.status(404).json({ message: 'Project not found' })
      return
    }

    // Check access control
    // For TEAM_LEAD, also check if they are the team_lead
    let hasAccess = false
    if (userRole === UserRole.MANAGER || userRole === UserRole.GROUP_HEAD) {
      hasAccess = true // Admins have full access
    } else if (userRole === UserRole.TEAM_LEAD) {
      // TEAM_LEAD: Check if member OR team_lead
      const membership = await ProjectMember.findOne({ projectId: id, userId })
      hasAccess = !!membership || project.team_lead.toString() === userId
    } else {
      // DEVELOPER: Must be a member
      const accessCheck = await hasProjectAccess(userId, userRole, id)
      hasAccess = accessCheck.hasAccess
    }

    if (!hasAccess) {
      console.log('[getProjectById] Access denied for user:', userId)
      res.status(403).json({ 
        message: 'You do not have access to this project. You must be a member to view it.' 
      })
      return
    }

    console.log('[getProjectById] Found project:', project.name)
    const members = await ProjectMember.find({ projectId: id }).populate('userId', 'name email image')
    const { Task } = await import('../models')
    const tasks = await Task.find({ projectId: id }).populate('assigneeId', 'name email image')

    res.json({
      ...project.toObject(),
      members,
      tasks,
    })
  } catch (error: any) {
    logger.error('[getProjectById] Error:', error)
    res.status(400).json({ message: error.message })
  }
}

export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = createProjectSchema.parse(req.body)

    // Verify team_lead exists
    const teamLead = await User.findById(data.team_lead)
    if (!teamLead) {
      res.status(400).json({ message: 'Team lead user not found' })
      return
    }

    const projectId = generateId()
    const project = new Project({
      _id: projectId,
      ...data,
    })
    await project.save()

    // Automatically add team_lead as a project member if not already a member
    const existingMember = await ProjectMember.findOne({
      projectId: projectId,
      userId: data.team_lead,
    })

    if (!existingMember) {
      const memberId = generateId()
      const teamLeadMember = new ProjectMember({
        _id: memberId,
        userId: data.team_lead,
        projectId: projectId,
      })
      await teamLeadMember.save()
    }

    const populated = await Project.findById(projectId)
      .populate('team_lead', 'name email image')
    res.status(201).json(populated)
  } catch (error: any) {
    logger.error('Create project error:', error)
    if (error.name === 'ZodError') {
      res.status(400).json({
        message: 'Validation error',
        errors: error.errors
      })
      return
    }
    res.status(400).json({ message: error.message || 'Failed to create project' })
  }
}

export const updateProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = projectParamsSchema.parse(req.params)
    const data = updateProjectSchema.parse(req.body)
    const userId = req.userId!
    const userRole = req.user?.role as UserRole

    // Check if project exists first
    const existingProject = await Project.findOne({ _id: id })
    if (!existingProject) {
      res.status(404).json({ message: 'Project not found' })
      return
    }

    // Check access control - TEAM_LEAD can only update projects they have access to
    if (userRole === UserRole.TEAM_LEAD) {
      const membership = await ProjectMember.findOne({ projectId: id, userId })
      const isTeamLead = existingProject.team_lead.toString() === userId
      
      if (!membership && !isTeamLead) {
        res.status(403).json({ 
          message: 'You do not have access to update this project. You must be the team lead or a member.' 
        })
        return
      }
    }
    // MANAGER and GROUP_HEAD have full access, no check needed

    // Use findOneAndUpdate with _id for custom string IDs
    const project = await Project.findOneAndUpdate({ _id: id }, data, { new: true })
      .populate('team_lead', 'name email image')
    
    if (!project) {
      res.status(500).json({ message: 'Failed to update project' })
      return
    }

    res.json(project)
  } catch (error: any) {
    logger.error('[updateProject] Error:', error)
    res.status(400).json({ message: error.message })
  }
}

export const deleteProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = projectParamsSchema.parse(req.params)
    const project = await Project.findById(id)
    if (!project) {
      res.status(404).json({ message: 'Project not found' })
      return
    }

    // Import all models needed for cascade deletion
    const { Task, Comment, Notification, TemporaryPermission, PermissionRequest, EODTask, EODReport } = await import('../models')

    // Get all task IDs for this project (needed for deleting comments and task-related notifications)
    const tasks = await Task.find({ projectId: id }).select('_id')
    const taskIds = tasks.map(t => t._id)

    // Cascade delete in order (respecting foreign key dependencies):
    // 1. Delete all comments on tasks in this project
    if (taskIds.length > 0) {
      await Comment.deleteMany({ taskId: { $in: taskIds } })
    }

    // 2. Delete EODTask records that reference tasks from this project
    // This must happen before deleting tasks
    if (taskIds.length > 0) {
      // Get EODReport IDs that have tasks from this project (BEFORE deleting)
      const affectedEODTasks = await EODTask.find({ taskId: { $in: taskIds } }).select('eodReportId')
      const affectedReportIds = [...new Set(affectedEODTasks.map(t => t.eodReportId.toString()))]
      
      // Delete EODTask records
      const deletedEODTasks = await EODTask.deleteMany({ taskId: { $in: taskIds } })
      logger.log(`[deleteProject] Deleted ${deletedEODTasks.deletedCount} EODTask records for tasks in project ${id}`)
      
      // Update EODReport counts for affected reports (recalculate based on remaining tasks)
      for (const reportId of affectedReportIds) {
        const remainingTasks = await EODTask.find({ eodReportId: reportId })
        const completedCount = remainingTasks.filter(t => t.status === 'COMPLETED').length
        const inProgressCount = remainingTasks.filter(t => t.status === 'IN_PROGRESS').length
        
        await EODReport.updateOne(
          { _id: reportId },
          {
            $set: {
              tasksCompleted: completedCount,
              tasksInProgress: inProgressCount,
            }
          }
        )
      }
      
      // Delete EODReports that have no remaining tasks (all tasks were from deleted project)
      for (const reportId of affectedReportIds) {
        const remainingTaskCount = await EODTask.countDocuments({ eodReportId: reportId })
        if (remainingTaskCount === 0) {
          await EODReport.deleteOne({ _id: reportId })
          logger.log(`[deleteProject] Deleted EODReport ${reportId} as it had no remaining tasks after project deletion`)
        }
      }
    }

    // 3. Delete all tasks in this project
    await Task.deleteMany({ projectId: id })

    // 4. Delete all notifications related to this project or its tasks
    await Notification.deleteMany({
      $or: [
        { projectId: id },
        { taskId: { $in: taskIds } },
        { relatedId: id } // Some notifications use relatedId for project
      ]
    })

    // 5. Delete all temporary permissions for this project
    await TemporaryPermission.deleteMany({ projectId: id })

    // 6. Delete all permission requests for this project
    await PermissionRequest.deleteMany({ projectId: id })

    // 7. Delete all project members
    await ProjectMember.deleteMany({ projectId: id })

    // 8. Finally, delete the project itself
    await Project.findByIdAndDelete(id)

    logger.log(`[deleteProject] Successfully deleted project ${id} and all related data`)
    res.json({ message: 'Project and all related data deleted successfully' })
  } catch (error: any) {
    logger.error('[deleteProject] Error:', error)
    res.status(400).json({ message: error.message })
  }
}

export const addProjectMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = projectParamsSchema.parse(req.params)
    const data = addProjectMemberSchema.parse(req.body)

    // Check if member already exists
    const existingMember = await ProjectMember.findOne({
      projectId: id,
      userId: data.userId
    })

    if (existingMember) {
      res.status(400).json({ message: 'User is already a member of this project' })
      return
    }

    // Check if project exists
    const project = await Project.findOne({ _id: id })
    if (!project) {
      res.status(404).json({ message: 'Project not found' })
      return
    }

    const memberId = generateId()
    const member = new ProjectMember({
      _id: memberId,
      userId: data.userId,
      projectId: id,
    })
    await member.save()
    const populated = await ProjectMember.findById(memberId).populate('userId', 'name email image')

    // Create Notification
    try {
      const { Notification } = await import('../models')
      await Notification.create({
        _id: generateId(),
        recipientId: data.userId, // The user being added
        senderId: req.user?.id,
        taskId: null, // Project notification, no task
        message: `You have been added to project "${project.name}"`,
        type: 'PROJECT_ADD',
        relatedId: id,
      })
    } catch (err) {
      console.error('Failed to create notification', err)
    }

    res.status(201).json(populated)
  } catch (error: any) {
    logger.error('Add project member error:', error)
    if (error.name === 'ZodError') {
      res.status(400).json({
        message: 'Validation error',
        errors: error.errors
      })
      return
    }
    res.status(400).json({ message: error.message || 'Failed to add project member' })
  }
}

export const removeProjectMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, userId } = req.params
    const member = await ProjectMember.findOneAndDelete({ projectId: id, userId })
    if (!member) {
      res.status(404).json({ message: 'Member not found' })
      return
    }
    res.json({ message: 'Member removed successfully' })
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

