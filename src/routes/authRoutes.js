import { Router } from 'express'
import { getMe, login, logout, requireAuth } from '../controllers/authController.js'

const router = Router()

router.post('/login', login)
router.post('/logout', requireAuth(), logout)

export const meRoute = Router()
meRoute.get('/me', requireAuth(), getMe)

export default router
