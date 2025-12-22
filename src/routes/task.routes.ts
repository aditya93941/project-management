import { Router } from 'express'
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
} from '../controllers/task.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate, validateParams } from '../middleware/validate.middleware'
import {
  createTaskSchema,
  updateTaskSchema,
  taskParamsSchema,
} from '../schemas'

const router = Router()

router.use(authenticate)

router.get('/', getTasks)
router.get('/:id', validateParams(taskParamsSchema), getTaskById)
router.post('/', validate(createTaskSchema), createTask)
router.put('/:id', validateParams(taskParamsSchema), validate(updateTaskSchema), updateTask)
router.delete('/:id', validateParams(taskParamsSchema), deleteTask)

export default router

