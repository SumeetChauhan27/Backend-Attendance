import { Router } from 'express'
import { requireAuth } from '../controllers/authController.js'
import {
  approveTeacherAccount,
  createClass,
  getAdminActivity,
  getTeacherStudentAttendance,
  listClassStudents,
  listClassStudentsAttendance,
  listClasses,
  listTeacherAccounts,
  registerTeacherAccount,
} from '../controllers/teacherController.js'

const router = Router()

router.post('/teachers/register', registerTeacherAccount)
router.get('/classes', requireAuth(['TEACHER', 'SUPER_ADMIN']), listClasses)
router.post('/classes', requireAuth(['TEACHER', 'SUPER_ADMIN']), createClass)
router.get('/classes/:id/students', requireAuth(['TEACHER', 'SUPER_ADMIN']), listClassStudents)
router.get(
  '/classes/:id/students/attendance',
  requireAuth(['TEACHER', 'SUPER_ADMIN']),
  listClassStudentsAttendance,
)
router.get(
  '/teachers/students/:studentId/attendance',
  requireAuth(['TEACHER', 'SUPER_ADMIN']),
  getTeacherStudentAttendance,
)
router.get('/admin/teachers', requireAuth('SUPER_ADMIN'), listTeacherAccounts)
router.post('/admin/teachers/:teacherId/approve', requireAuth('SUPER_ADMIN'), approveTeacherAccount)
router.get('/admin/activity', requireAuth('SUPER_ADMIN'), getAdminActivity)

export default router
