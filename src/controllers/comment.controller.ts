import { Response } from 'express'
import { Comment, Task, Notification, Project } from '../models'
import { generateId } from '../utils/generateId'
import { createCommentSchema, updateCommentSchema, commentParamsSchema } from '../schemas'
import { AuthRequest } from '../middleware/auth.middleware'
import { isUserViewingTask } from '../utils/taskViewingTracker'

export const getComments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter: any = {}
    if (req.query.taskId) filter.taskId = req.query.taskId
    if (req.query.userId) filter.userId = req.query.userId

    // Handle sort
    const sort: any = { createdAt: 1 } // Default to oldest first (for chat flow)
    if (req.query._sort && req.query._order) {
      const sortField = req.query._sort as string
      const sortOrder = req.query._order === 'asc' ? 1 : -1
      sort[sortField] = sortOrder
    }

    const comments = await Comment.find(filter)
      .populate('userId', 'name email image')
      .populate('taskId', 'title')
      .sort(sort)

    res.json(comments)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export const getCommentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = commentParamsSchema.parse(req.params)
    const comment = await Comment.findById(id)
      .populate('userId', 'name email image')
      .populate('taskId', 'title')
    if (!comment) {
      res.status(404).json({ message: 'Comment not found' })
      return
    }
    res.json(comment)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const createComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = createCommentSchema.parse(req.body)
    const commentId = generateId()
    const comment = new Comment({
      _id: commentId,
      ...data,
      userId: req.user?.id,
    })
    await comment.save()

    // Create Notifications
    try {
      const task = await Task.findById(data.taskId)
        .populate('projectId', 'name team_lead')
      
      if (!task) return
      
      const recipients = new Set<string>()
      
      // Notify assignee if they are not the commenter and not currently viewing
      if (task.assigneeId && task.assigneeId !== req.user?.id) {
        const assigneeId = task.assigneeId.toString()
        const isViewing = isUserViewingTask(data.taskId, assigneeId)
        if (!isViewing) {
          recipients.add(assigneeId)
        }
      }
      
      // Notify task creator if they are not the commenter and not viewing
      if (task.createdById && task.createdById !== req.user?.id) {
        const creatorId = task.createdById.toString()
        const isViewing = isUserViewingTask(data.taskId, creatorId)
        if (!isViewing && !recipients.has(creatorId)) {
          recipients.add(creatorId)
        }
      }
      
      // Notify project team lead if they are not the commenter and not viewing
      const project = task.projectId as any
      if (project?.team_lead && project.team_lead !== req.user?.id) {
        const teamLeadId = project.team_lead.toString()
        const isViewing = isUserViewingTask(data.taskId, teamLeadId)
        if (!isViewing && !recipients.has(teamLeadId)) {
          recipients.add(teamLeadId)
        }
      }
      
      // Notify project members who have commented on this task (active participants)
      const previousComments = await Comment.find({ taskId: data.taskId })
        .select('userId')
        .distinct('userId')
      
      for (const commenterId of previousComments) {
        if (commenterId && commenterId.toString() !== req.user?.id) {
          const commenterIdStr = commenterId.toString()
          const isViewing = isUserViewingTask(data.taskId, commenterIdStr)
          if (!isViewing && !recipients.has(commenterIdStr)) {
            recipients.add(commenterIdStr)
          }
        }
      }
      
      // Create notifications for all recipients
      for (const recipientId of recipients) {
        await Notification.create({
          _id: generateId(),
          recipientId,
          senderId: req.user?.id,
          taskId: task._id,
          message: `${req.user?.name || 'Someone'} commented on task "${task.title}"`,
          type: 'COMMENT',
          relatedId: task._id,
        })
      }
    } catch (err) {
      console.error('Failed to create notification', err)
      // Continue execution, don't fail comment creation
    }

    const populated = await Comment.findById(commentId)
      .populate('userId', 'name email image')
      .populate('taskId', 'title')
    res.status(201).json(populated)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const updateComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = commentParamsSchema.parse(req.params)
    const data = updateCommentSchema.parse(req.body)
    const existingComment = await Comment.findById(id)
    if (!existingComment) {
      res.status(404).json({ message: 'Comment not found' })
      return
    }

    if (existingComment.userId.toString() !== req.user?.id) {
      res.status(403).json({ message: 'You can only edit your own comments' })
      return
    }

    const comment = await Comment.findByIdAndUpdate(
      id,
      {
        ...data,
        edited: true,
        editedAt: new Date(),
      },
      { new: true }
    )
      .populate('userId', 'name email image')
      .populate('taskId', 'title')

    res.json(comment)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const deleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = commentParamsSchema.parse(req.params)
    const existingComment = await Comment.findById(id)
    if (!existingComment) {
      res.status(404).json({ message: 'Comment not found' })
      return
    }

    if (existingComment.userId.toString() !== req.user?.id) {
      res.status(403).json({ message: 'You can only delete your own comments' })
      return
    }

    await Comment.findByIdAndDelete(id)
    res.json({ message: 'Comment deleted successfully' })
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

