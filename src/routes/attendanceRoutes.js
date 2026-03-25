import { Router } from 'express'
import { requireAuth } from '../controllers/authController.js'
import {
  closeClassSession,
  exportClassAttendanceCsv,
  getActiveClassSession,
  health,
  listClassSessions,
  listSessionAttendance,
  listSessionAttendanceDetails,
  markAttendanceByQr,
  markAttendanceSecure,
  markTeacherAttendanceByFace,
  openClassSession,
  startQrSession,
  validateQrSession,
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
router.post(
  '/teachers/attendance/manual-mark',
  requireAuth(['TEACHER', 'SUPER_ADMIN']),
  markTeacherAttendanceByFace,
)
import { matchFace } from '../controllers/faceController.js'

router.post('/attendance/mark', markAttendanceByQr)
router.post('/session/validate', validateQrSession)
router.post('/attendance/mark-secure', markAttendanceSecure)
router.get('/attendance/export/:classId', requireAuth(['TEACHER', 'SUPER_ADMIN']), exportClassAttendanceCsv)
router.post('/face/match', matchFace)

export default router
