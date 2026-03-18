import { promises as fs } from 'node:fs'
import { nanoid } from 'nanoid'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const teachersFile = path.join(__dirname, '../database/teachers.json')
const studentsFile = path.join(__dirname, '../database/students.json')
const attendanceFile = path.join(__dirname, '../database/attendance.json')

const attendanceDefaults = {
  classes: [],
  sessions: [],
  qrSessions: [],
  attendance: [],
}

const normalizeTeacher = (user) => ({
  ...user,
  role:
    user.role === 'teacher'
      ? 'TEACHER'
      : user.role === 'super_admin'
        ? 'SUPER_ADMIN'
        : user.role,
  approved:
    user.role === 'teacher'
      ? true
      : user.role === 'TEACHER'
        ? user.approved ?? true
        : user.role === 'SUPER_ADMIN'
          ? true
          : user.approved,
  department:
    user.role === 'SUPER_ADMIN' || user.role === 'super_admin'
      ? user.department ?? 'Administration'
      : user.department ?? '',
  roll: user.roll ?? '',
  classId: user.classId ?? '',
})

const normalizeStudent = (user) => ({
  ...user,
  role: user.role === 'student' ? 'STUDENT' : user.role,
  department: user.department ?? '',
  roll: user.roll ?? user.rollNumber ?? '',
  rollNumber: user.rollNumber ?? user.roll ?? '',
  year: user.year ?? '',
  faceEmbedding: user.faceEmbedding ?? null,
})

const normalizeAttendanceState = (data) => ({
  classes: Array.isArray(data?.classes) ? data.classes : [],
  sessions: Array.isArray(data?.sessions) ? data.sessions : [],
  qrSessions: Array.isArray(data?.qrSessions) ? data.qrSessions : [],
  attendance: Array.isArray(data?.attendance) ? data.attendance : [],
})

const readJson = async (filePath, fallback) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback
    }
    throw error
  }
}

const writeJson = async (filePath, data) => {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

const readTeachers = async () => {
  const data = await readJson(teachersFile, [])
  return Array.isArray(data) ? data.map(normalizeTeacher) : []
}

const writeTeachers = async (teachers) => {
  await writeJson(teachersFile, teachers)
}

const readStudents = async () => {
  const data = await readJson(studentsFile, [])
  return Array.isArray(data) ? data.map(normalizeStudent) : []
}

const writeStudents = async (students) => {
  await writeJson(studentsFile, students)
}

const readAttendanceState = async () => {
  const data = await readJson(attendanceFile, attendanceDefaults)
  return normalizeAttendanceState(data)
}

const writeAttendanceState = async (data) => {
  await writeJson(attendanceFile, data)
}

const readState = async () => {
  const [teachers, students, attendance] = await Promise.all([
    readTeachers(),
    readStudents(),
    readAttendanceState(),
  ])

  return { teachers, students, attendance }
}

const getAllUsers = (state) => [...state.teachers, ...state.students]

export const initDb = async () => {
  const state = await readState()
  await Promise.all([
    writeTeachers(state.teachers),
    writeStudents(state.students),
    writeAttendanceState(state.attendance),
  ])
}

export const seedSuperAdmin = async (adminId, password) => {
  const state = await readState()
  const existing = state.teachers.find((user) => user.id === adminId)

  if (existing) {
    existing.role = 'SUPER_ADMIN'
    existing.password = password
    existing.name = existing.name || 'Super Admin'
    existing.roll = existing.roll || ''
    existing.classId = existing.classId || ''
    existing.department = existing.department || 'Administration'
    existing.approved = true
  } else {
    state.teachers.push({
      id: adminId,
      role: 'SUPER_ADMIN',
      password,
      name: 'Super Admin',
      roll: '',
      classId: '',
      department: 'Administration',
      approved: true,
    })
  }

  await writeTeachers(state.teachers)
}

export const seedTeacher = async (teacherId, password) => {
  const state = await readState()
  const existing = state.teachers.find((user) => user.id === teacherId)

  if (!existing) {
    state.teachers.push({
      id: teacherId,
      role: 'TEACHER',
      password,
      name: 'Teacher',
      roll: '',
      classId: '',
      department: 'General',
      approved: true,
    })
    await writeTeachers(state.teachers)
  }
}

export const getUserById = async (id) => {
  const state = await readState()
  return getAllUsers(state).find((user) => user.id === id) || null
}

export const getUserByLogin = async (login) => {
  const state = await readState()
  return getAllUsers(state).find((user) => user.id === login || user.email === login) || null
}

export const createClass = async (name) => {
  const state = await readState()
  const existing = state.attendance.classes.find((item) => item.name === name)
  if (existing) return existing

  const record = { id: nanoid(), name }
  state.attendance.classes.push(record)
  await writeAttendanceState(state.attendance)
  return record
}

export const listClasses = async () => {
  const state = await readState()
  return state.attendance.classes
}

export const createStudent = async ({
  id,
  password,
  name,
  rollNumber,
  department,
  year,
  classId,
}) => {
  const state = await readState()
  const studentId = id || rollNumber
  const existing = getAllUsers(state).find((user) => user.id === studentId)
  if (existing) {
    throw new Error('Student ID already exists')
  }

  const record = {
    id: studentId,
    role: 'STUDENT',
    password: password || rollNumber,
    name,
    roll: rollNumber,
    rollNumber,
    classId,
    department: department ?? '',
    year: year ?? '',
    faceEmbedding: null,
  }

  state.students.push(record)
  await writeStudents(state.students)
  return record
}

export const updateStudent = async (
  studentId,
  { name, rollNumber, department, year, faceEmbedding },
) => {
  const state = await readState()
  const student = state.students.find((user) => user.id === studentId)
  if (!student) return null

  student.name = name ?? student.name
  student.roll = rollNumber ?? student.roll
  student.rollNumber = rollNumber ?? student.rollNumber ?? student.roll
  student.department = department ?? student.department ?? ''
  student.year = year ?? student.year ?? ''
  student.faceEmbedding = faceEmbedding ?? student.faceEmbedding ?? null

  await writeStudents(state.students)
  return student
}

export const deleteStudent = async (studentId) => {
  const state = await readState()
  const studentIndex = state.students.findIndex((user) => user.id === studentId)
  if (studentIndex === -1) return false

  state.students.splice(studentIndex, 1)
  state.attendance.attendance = state.attendance.attendance.filter(
    (record) => record.studentId !== studentId,
  )
  state.attendance.qrSessions = state.attendance.qrSessions.map((session) => ({
    ...session,
    attendance: session.attendance.filter((id) => id !== studentId),
  }))

  await Promise.all([
    writeStudents(state.students),
    writeAttendanceState(state.attendance),
  ])
  return true
}

export const registerTeacher = async ({ name, email, password, department }) => {
  const state = await readState()
  const normalizedEmail = String(email).trim().toLowerCase()
  const existing = getAllUsers(state).find(
    (user) => user.email?.toLowerCase() === normalizedEmail || user.id === normalizedEmail,
  )
  if (existing) {
    throw new Error('Teacher account already exists for this email')
  }

  const record = {
    id: nanoid(10),
    name,
    email: normalizedEmail,
    password,
    department,
    role: 'TEACHER',
    approved: false,
    roll: '',
    classId: '',
  }

  state.teachers.push(record)
  await writeTeachers(state.teachers)

  const { password: _password, ...safeTeacher } = record
  return safeTeacher
}

export const listStudentsByClass = async (classId) => {
  const state = await readState()
  return state.students.filter((user) => user.classId === classId)
}

export const listStudentsWithAttendance = async (classId) => {
  const state = await readState()
  const students = state.students.filter((user) => user.classId === classId)
  const sessions = state.attendance.sessions.filter((session) => session.classId === classId)
  const sessionIds = new Set(sessions.map((session) => session.id))
  const total = sessions.length
  const attendanceByStudent = new Map()

  state.attendance.attendance.forEach((record) => {
    if (!sessionIds.has(record.sessionId)) return
    const count = attendanceByStudent.get(record.studentId) ?? 0
    attendanceByStudent.set(record.studentId, count + 1)
  })

  return students.map((student) => {
    const present = attendanceByStudent.get(student.id) ?? 0
    const percentage = total ? Math.round((present / total) * 100) : 0
    return {
      ...student,
      rollNumber: student.rollNumber ?? student.roll,
      attendance: { present, total, percentage },
    }
  })
}

export const openSession = async ({ classId, subject, timing }) => {
  const state = await readState()
  const active = state.attendance.sessions.find(
    (session) => session.classId === classId && session.status === 'open',
  )
  if (active) return active

  const record = {
    id: nanoid(),
    classId,
    subject,
    timing,
    date: new Date().toISOString().slice(0, 10),
    status: 'open',
    createdAt: new Date().toISOString(),
  }

  state.attendance.sessions.push(record)
  await writeAttendanceState(state.attendance)
  return record
}

export const closeSession = async (sessionId) => {
  const state = await readState()
  const session = state.attendance.sessions.find((item) => item.id === sessionId)
  if (!session) return null

  session.status = 'closed'
  session.closedAt = new Date().toISOString()
  await writeAttendanceState(state.attendance)
  return session
}

export const getActiveSession = async (classId) => {
  const state = await readState()
  return (
    state.attendance.sessions.find(
      (session) => session.classId === classId && session.status === 'open',
    ) || null
  )
}

export const getSessionById = async (sessionId) => {
  const state = await readState()
  return state.attendance.sessions.find((session) => session.id === sessionId) || null
}

export const markAttendance = async ({ sessionId, studentId }) => {
  const state = await readState()
  const existing = state.attendance.attendance.find(
    (record) => record.sessionId === sessionId && record.studentId === studentId,
  )
  if (existing) return existing

  const record = {
    id: nanoid(),
    sessionId,
    studentId,
    timestamp: new Date().toISOString(),
  }

  state.attendance.attendance.push(record)
  await writeAttendanceState(state.attendance)
  return record
}

export const listAttendanceBySession = async (sessionId) => {
  const state = await readState()
  return state.attendance.attendance.filter((record) => record.sessionId === sessionId)
}

export const listSessionsByClass = async (classId) => {
  const state = await readState()
  return state.attendance.sessions.filter((session) => session.classId === classId)
}

export const listAttendanceDetailed = async (sessionId) => {
  const state = await readState()
  const records = state.attendance.attendance.filter((record) => record.sessionId === sessionId)

  return records.map((record) => {
    const student = state.students.find((user) => user.id === record.studentId)
    return {
      ...record,
      student: student
        ? { id: student.id, name: student.name, roll: student.roll }
        : { id: record.studentId, name: 'Unknown', roll: '' },
    }
  })
}

export const listStudentAttendanceSummary = async (studentId) => {
  const state = await readState()
  const student = state.students.find((user) => user.id === studentId)
  if (!student || !student.classId) return []

  const sessions = state.attendance.sessions.filter((session) => session.classId === student.classId)
  const attendance = state.attendance.attendance.filter((record) => record.studentId === studentId)
  const attendanceSet = new Set(attendance.map((record) => record.sessionId))

  return sessions.map((session) => ({
    id: session.id,
    subject: session.subject,
    timing: session.timing,
    date: session.date,
    status: session.status,
    present: attendanceSet.has(session.id),
  }))
}

export const getStudentById = async (studentId) => {
  const state = await readState()
  return state.students.find((user) => user.id === studentId) || null
}

export const listTeachers = async () => {
  const state = await readState()
  return state.teachers
    .filter((user) => user.role === 'TEACHER')
    .map(({ password, ...teacher }) => teacher)
}

export const approveTeacher = async (teacherId) => {
  const state = await readState()
  const teacher = state.teachers.find((user) => user.id === teacherId && user.role === 'TEACHER')
  if (!teacher) return null

  teacher.approved = true
  await writeTeachers(state.teachers)

  const { password, ...safeTeacher } = teacher
  return safeTeacher
}

export const getSystemActivity = async () => {
  const state = await readState()
  const teachers = state.teachers.filter((user) => user.role === 'TEACHER')
  const activeSessions = state.attendance.sessions.filter((session) => session.status === 'open')

  return {
    totals: {
      teachers: teachers.length,
      approvedTeachers: teachers.filter((teacher) => teacher.approved).length,
      pendingTeachers: teachers.filter((teacher) => !teacher.approved).length,
      students: state.students.length,
      classes: state.attendance.classes.length,
      sessions: state.attendance.sessions.length,
      activeSessions: activeSessions.length,
      attendanceRecords: state.attendance.attendance.length,
    },
    recentSessions: state.attendance.sessions
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 5),
  }
}

export const createQrSession = async (payload) => {
  const state = await readState()
  state.attendance.qrSessions.push(payload)
  await writeAttendanceState(state.attendance)
  return payload
}

export const findQrSessionById = async (sessionId) => {
  const state = await readState()
  return state.attendance.qrSessions.find((session) => session.id === sessionId) || null
}

export const saveQrSession = async (session) => {
  const state = await readState()
  const index = state.attendance.qrSessions.findIndex((item) => item.id === session.id)
  if (index === -1) return null

  state.attendance.qrSessions[index] = session
  await writeAttendanceState(state.attendance)
  return session
}
