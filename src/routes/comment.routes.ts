import { Router } from 'express'
import {
  getComments,
  getCommentById,
  createComment,
  updateComment,
  deleteComment,
} from '../controllers/comment.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate, validateParams } from '../middleware/validate.middleware'
import {
  createCommentSchema,
  updateCommentSchema,
  commentParamsSchema,
} from '../schemas'

const router = Router()

router.use(authenticate)

router.get('/', getComments)
router.get('/:id', validateParams(commentParamsSchema), getCommentById)
router.post('/', validate(createCommentSchema), createComment)
router.put('/:id', validateParams(commentParamsSchema), validate(updateCommentSchema), updateComment)
router.delete('/:id', validateParams(commentParamsSchema), deleteComment)

export default router

