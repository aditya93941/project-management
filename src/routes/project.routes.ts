import { Router } from 'express'
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
} from '../controllers/project.controller'
import { authenticate } from '../middleware/auth.middleware'
import { authorizeMinimum } from '../middleware/authorize.middleware'
import { validate, validateParams } from '../middleware/validate.middleware'
import {
  createProjectSchema,
  updateProjectSchema,
  projectParamsSchema,
  addProjectMemberSchema,
} from '../schemas'
import { UserRole } from '../models/User.model'

const router = Router()

router.use(authenticate)

// All authenticated users can view projects
router.get('/', getProjects)
router.get('/:id', validateParams(projectParamsSchema), getProjectById)

// TEAM_LEAD and above can create projects
router.post('/', authorizeMinimum(UserRole.TEAM_LEAD), validate(createProjectSchema), createProject)

// TEAM_LEAD and above can update projects
router.put('/:id', authorizeMinimum(UserRole.TEAM_LEAD), validateParams(projectParamsSchema), validate(updateProjectSchema), updateProject)

// GROUP_HEAD and above can delete projects
router.delete('/:id', authorizeMinimum(UserRole.GROUP_HEAD), validateParams(projectParamsSchema), deleteProject)

// TEAM_LEAD and above can manage project members
router.post('/:id/members', authorizeMinimum(UserRole.TEAM_LEAD), validateParams(projectParamsSchema), validate(addProjectMemberSchema), addProjectMember)
router.delete('/:id/members/:userId', authorizeMinimum(UserRole.TEAM_LEAD), validateParams(projectParamsSchema), removeProjectMember)

export default router

