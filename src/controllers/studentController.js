import {
  getActiveSession,
  getUserById,
  listStudentAttendanceSummary,
  markAttendance,
} from '../db.js'
import { toStudentFaceEmbeddingPayload } from '../services/faceRecognitionService.js'
import {
  createSpreadsheetStudent,
  removeSpreadsheetStudent,
  updateSpreadsheetStudent,
} from '../services/spreadsheetService.js'

export const createStudent = async (req, res) => {
  const { id, password, name, rollNumber, department, year, classId } = req.body ?? {}
  if (!name || !rollNumber || !classId) {
    res.status(400).send('Missing student fields')
    return
  }

  try {
    res.json(
      await createSpreadsheetStudent({
        id,
        password,
        name,
        rollNumber,
        department,
        year,
        classId,
      }),
    )
  } catch (error) {
    res.status(400).send(error.message || 'Unable to create student')
  }
}

export const updateStudent = async (req, res) => {
  const { name, rollNumber, department, year, faceEmbedding } = req.body ?? {}
  const updated = await updateSpreadsheetStudent(req.params.studentId, {
    name,
    rollNumber,
    department,
    year,
    faceEmbedding,
  })

  if (!updated) {
    res.status(404).send('Student not found')
    return
  }

  res.json(updated)
}

export const deleteStudent = async (req, res) => {
  const removed = await removeSpreadsheetStudent(req.params.studentId)
  if (!removed) {
    res.status(404).send('Student not found')
    return
  }

  res.json({ ok: true })
}

export const getStudentSession = async (req, res) => {
  const user = await getUserById(req.auth.userId)
  if (!user) {
    res.status(404).send('User not found')
    return
  }

  if (!user.classId) {
    res.status(400).send('Student not assigned to class')
    return
  }

  const session = await getActiveSession(user.classId)
  res.json(session ?? null)
}

export const getStudentFaceEmbedding = async (req, res) => {
  const user = await getUserById(req.auth.userId)
  if (!user) {
    res.status(404).send('User not found')
    return
  }

  res.json(toStudentFaceEmbeddingPayload(user))
}

export const markStudentAttendance = async (req, res) => {
  const user = await getUserById(req.auth.userId)
  if (!user) {
    res.status(404).send('User not found')
    return
  }

  const session = await getActiveSession(user.classId)
  if (!session) {
    res.status(403).send('No active session')
    return
  }

  const record = await markAttendance({
    sessionId: session.id,
    studentId: user.id,
  })
  res.json(record)
}

export const getStudentAttendanceHistory = async (req, res) => {
  const records = await listStudentAttendanceSummary(req.auth.userId)
  records.sort((a, b) => {
    const dateA = a.date || ''
    const dateB = b.date || ''
    if (dateA !== dateB) return dateB.localeCompare(dateA)
    return (b.id || '').localeCompare(a.id || '')
  })
  res.json(records)
}
