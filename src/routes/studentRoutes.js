import { Router } from 'express'
import { requireAuth } from '../controllers/authController.js'
import {
  createStudent,
  deleteStudent,
  getStudentAttendanceHistory,
  getStudentFaceEmbedding,
  registerStudentFaceEmbedding,
  getStudentSession,
  markStudentAttendance,
  updateStudent,
} from '../controllers/studentController.js'

const router = Router()

router.post('/students', requireAuth(['TEACHER', 'SUPER_ADMIN']), createStudent)
router.put('/students/:studentId', requireAuth(['TEACHER', 'SUPER_ADMIN']), updateStudent)
router.delete('/students/:studentId', requireAuth(['TEACHER', 'SUPER_ADMIN']), deleteStudent)
router.get('/student/session', requireAuth('STUDENT'), getStudentSession)
router.get('/student/face-embedding', requireAuth('STUDENT'), getStudentFaceEmbedding)
router.post('/student/face-embedding', requireAuth('STUDENT'), registerStudentFaceEmbedding)
router.post('/student/attendance', requireAuth('STUDENT'), markStudentAttendance)
router.get('/student/attendance/history', requireAuth('STUDENT'), getStudentAttendanceHistory)

export default router
