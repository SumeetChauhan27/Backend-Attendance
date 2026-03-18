import { Router } from 'express'
import { requireAuth } from '../controllers/authController.js'
import {
  closeClassSession,
  getActiveClassSession,
  health,
  listClassSessions,
  listSessionAttendance,
  listSessionAttendanceDetails,
  markAttendanceByQr,
  markTeacherAttendanceByFace,
  openClassSession,
  startQrSession,
} from '../controllers/attendanceController.js'

const router = Router()

router.get('/health', health)
router.post('/sessions/open', requireAuth(['TEACHER', 'SUPER_ADMIN']), openClassSession)
router.post('/session/start', requireAuth(['TEACHER', 'SUPER_ADMIN']), startQrSession)
router.post('/sessions/close', requireAuth(['TEACHER', 'SUPER_ADMIN']), closeClassSession)
router.get('/sessions/active/:classId', requireAuth(['TEACHER', 'SUPER_ADMIN']), getActiveClassSession)
router.get('/attendance/session/:sessionId', requireAuth(['TEACHER', 'SUPER_ADMIN']), listSessionAttendance)
router.get(
  '/attendance/session/:sessionId/details',
  requireAuth(['TEACHER', 'SUPER_ADMIN']),
  listSessionAttendanceDetails,
)
router.get('/sessions/class/:classId', requireAuth(['TEACHER', 'SUPER_ADMIN']), listClassSessions)
router.post(
  '/teachers/attendance/face-mark',
  requireAuth(['TEACHER', 'SUPER_ADMIN']),
  markTeacherAttendanceByFace,
)
router.post('/attendance/mark', markAttendanceByQr)

export default router
