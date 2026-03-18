import {
  approveTeacher,
  getStudentById,
  getSystemActivity,
  listStudentAttendanceSummary,
  listTeachers,
  registerTeacher,
} from '../db.js'
import {
  createSpreadsheetClass,
  listSpreadsheetClasses,
  listSpreadsheetStudents,
  listSpreadsheetStudentsWithAttendance,
} from '../services/spreadsheetService.js'

export const registerTeacherAccount = async (req, res) => {
  const { name, email, password, department } = req.body ?? {}
  if (!name || !email || !password || !department) {
    res.status(400).send('Name, email, password, and department are required')
    return
  }

  try {
    const teacher = await registerTeacher({ name, email, password, department })
    res.status(201).json(teacher)
  } catch (error) {
    res.status(400).send(error.message || 'Unable to register teacher')
  }
}

export const listClasses = async (_req, res) => {
  res.json(await listSpreadsheetClasses())
}

export const createClass = async (req, res) => {
  const { name } = req.body ?? {}
  if (!name) {
    res.status(400).send('Class name required')
    return
  }

  res.json(await createSpreadsheetClass(name))
}

export const listClassStudents = async (req, res) => {
  res.json(await listSpreadsheetStudents(req.params.id))
}

export const listClassStudentsAttendance = async (req, res) => {
  res.json(await listSpreadsheetStudentsWithAttendance(req.params.id))
}

export const getTeacherStudentAttendance = async (req, res) => {
  const student = await getStudentById(req.params.studentId)
  if (!student || student.role !== 'STUDENT') {
    res.status(404).send('Student not found')
    return
  }

  const records = await listStudentAttendanceSummary(req.params.studentId)
  res.json({
    student: { id: student.id, name: student.name, roll: student.roll },
    records,
  })
}

export const listTeacherAccounts = async (_req, res) => {
  res.json(await listTeachers())
}

export const approveTeacherAccount = async (req, res) => {
  const teacher = await approveTeacher(req.params.teacherId)
  if (!teacher) {
    res.status(404).send('Teacher not found')
    return
  }

  res.json(teacher)
}

export const getAdminActivity = async (_req, res) => {
  res.json(await getSystemActivity())
}
