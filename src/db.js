import { nanoid } from 'nanoid'
import {
  appendRow,
  deleteRow,
  getRows,
  initSheets,
  setAllRows,
  updateRow,
} from './services/googleSheets.js'

// --- Normalization helpers (same logic, applied after reading from sheets) ---

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
  role: user.role === 'student' ? 'STUDENT' : (user.role || 'STUDENT'),
  department: user.department ?? '',
  roll: user.roll ?? user.rollNumber ?? '',
  rollNumber: user.rollNumber ?? user.roll ?? '',
  year: user.year ?? '',
  faceEmbedding: user.faceEmbedding ?? null,
})

// --- Read helpers ---

const readTeachers = async () => {
  const rows = await getRows('Teachers')
  return rows.map(normalizeTeacher)
}

const readStudents = async () => {
  const rows = await getRows('Students')
  return rows.map(normalizeStudent)
}

const readClasses = async () => getRows('Classes')

const readSessions = async () => getRows('Sessions')

const readAttendance = async () => getRows('Attendance')

const readQrSessions = async () => {
  const rows = await getRows('QrSessions')
  return rows.map((row) => ({
    ...row,
    attendance: Array.isArray(row.attendance) ? row.attendance : [],
  }))
}

const getAllUsers = async () => {
  const [teachers, students] = await Promise.all([readTeachers(), readStudents()])
  return [...teachers, ...students]
}

// --- Init ---

export const initDb = async () => {
  await initSheets()
}

// --- Seed ---

export const seedSuperAdmin = async (adminId, password) => {
  const teachers = await readTeachers()
  const existing = teachers.find((user) => user.id === adminId)

  if (existing) {
    const index = teachers.indexOf(existing)
    existing.role = 'SUPER_ADMIN'
    existing.password = password
    existing.name = existing.name || 'Super Admin'
    existing.roll = existing.roll || ''
    existing.classId = existing.classId || ''
    existing.department = existing.department || 'Administration'
    existing.approved = true
    await updateRow('Teachers', index, existing)
  } else {
    await appendRow('Teachers', {
      id: adminId,
      role: 'SUPER_ADMIN',
      password,
      name: 'Super Admin',
      roll: '',
      classId: '',
      department: 'Administration',
      approved: true,
      email: '',
    })
  }
}

export const seedTeacher = async (teacherId, password) => {
  const teachers = await readTeachers()
  const existing = teachers.find((user) => user.id === teacherId)

  if (!existing) {
    await appendRow('Teachers', {
      id: teacherId,
      role: 'TEACHER',
      password,
      name: 'Teacher',
      roll: '',
      classId: '',
      department: 'General',
      approved: true,
      email: '',
    })
  }
}

// --- User lookups ---

export const getUserById = async (id) => {
  const users = await getAllUsers()
  return users.find((user) => user.id === id) || null
}

export const getUserByLogin = async (login) => {
  const users = await getAllUsers()
  return users.find((user) => user.id === login || user.email === login) || null
}

// --- Classes ---

export const createClass = async (name) => {
  const classes = await readClasses()
  const existing = classes.find((item) => item.name === name)
  if (existing) return existing

  const record = { id: nanoid(), name }
  await appendRow('Classes', record)
  return record
}

export const listClasses = async () => readClasses()

// --- Students ---

export const createStudent = async ({
  id,
  password,
  name,
  rollNumber,
  department,
  year,
  classId,
}) => {
  const users = await getAllUsers()
  const studentId = id || rollNumber
  const existing = users.find((user) => user.id === studentId)
  if (existing) {
    throw new Error('Student ID already exists')
  }

  const record = {
    id: studentId,
    name,
    roll: rollNumber,
    rollNumber,
    classId,
    department: department ?? '',
    year: year ?? '',
    password: password || rollNumber,
    faceEmbedding: null,
  }

  await appendRow('Students', record)
  return { ...record, role: 'STUDENT' }
}

export const updateStudent = async (
  studentId,
  { name, rollNumber, department, year, faceEmbedding },
) => {
  const students = await readStudents()
  const index = students.findIndex((user) => user.id === studentId)
  if (index === -1) return null

  const student = students[index]
  student.name = name ?? student.name
  student.roll = rollNumber ?? student.roll
  student.rollNumber = rollNumber ?? student.rollNumber ?? student.roll
  student.department = department ?? student.department ?? ''
  student.year = year ?? student.year ?? ''
  student.faceEmbedding = faceEmbedding ?? student.faceEmbedding ?? null

  await updateRow('Students', index, student)
  return student
}

export const deleteStudent = async (studentId) => {
  const students = await readStudents()
  const index = students.findIndex((user) => user.id === studentId)
  if (index === -1) return false

  await deleteRow('Students', index)

  // Clean up attendance records
  const attendance = await readAttendance()
  const filtered = attendance.filter((record) => record.studentId !== studentId)
  if (filtered.length !== attendance.length) {
    await setAllRows('Attendance', filtered)
  }

  // Clean up QR session attendance
  const qrSessions = await readQrSessions()
  let qrChanged = false
  const updatedQr = qrSessions.map((session) => {
    const newAttendance = session.attendance.filter((id) => id !== studentId)
    if (newAttendance.length !== session.attendance.length) {
      qrChanged = true
      return { ...session, attendance: newAttendance }
    }
    return session
  })
  if (qrChanged) {
    await setAllRows('QrSessions', updatedQr)
  }

  return true
}

// --- Teachers ---

export const registerTeacher = async ({ name, email, password, department }) => {
  const users = await getAllUsers()
  const normalizedEmail = String(email).trim().toLowerCase()
  const existing = users.find(
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

  await appendRow('Teachers', record)
  const { password: _password, ...safeTeacher } = record
  return safeTeacher
}

export const listStudentsByClass = async (classId) => {
  const students = await readStudents()
  return students.filter((user) => user.classId === classId)
}

export const listStudentsWithAttendance = async (classId) => {
  const [students, sessions, attendance] = await Promise.all([
    readStudents(),
    readSessions(),
    readAttendance(),
  ])

  const classStudents = students.filter((user) => user.classId === classId)
  const classSessions = sessions.filter((session) => session.classId === classId)
  const sessionIds = new Set(classSessions.map((session) => session.id))
  const total = classSessions.length
  const attendanceByStudent = new Map()

  attendance.forEach((record) => {
    if (!sessionIds.has(record.sessionId)) return
    const count = attendanceByStudent.get(record.studentId) ?? 0
    attendanceByStudent.set(record.studentId, count + 1)
  })

  return classStudents.map((student) => {
    const present = attendanceByStudent.get(student.id) ?? 0
    const percentage = total ? Math.round((present / total) * 100) : 0
    return {
      ...student,
      rollNumber: student.rollNumber ?? student.roll,
      attendance: { present, total, percentage },
    }
  })
}

// --- Sessions ---

export const openSession = async ({ classId, subject, timing }) => {
  const sessions = await readSessions()
  const active = sessions.find(
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
    closedAt: '',
  }

  await appendRow('Sessions', record)
  return record
}

export const closeSession = async (sessionId) => {
  const sessions = await readSessions()
  const index = sessions.findIndex((item) => item.id === sessionId)
  if (index === -1) return null

  const session = sessions[index]
  session.status = 'closed'
  session.closedAt = new Date().toISOString()
  await updateRow('Sessions', index, session)
  return session
}

export const getActiveSession = async (classId) => {
  const sessions = await readSessions()
  return (
    sessions.find(
      (session) => session.classId === classId && session.status === 'open',
    ) || null
  )
}

export const getSessionById = async (sessionId) => {
  const sessions = await readSessions()
  return sessions.find((session) => session.id === sessionId) || null
}

// --- Attendance ---

export const markAttendance = async ({ sessionId, studentId }) => {
  const attendance = await readAttendance()
  const existing = attendance.find(
    (record) => record.sessionId === sessionId && record.studentId === studentId,
  )
  if (existing) return existing

  const record = {
    id: nanoid(),
    sessionId,
    studentId,
    timestamp: new Date().toISOString(),
  }

  await appendRow('Attendance', record)
  return record
}

export const listAttendanceBySession = async (sessionId) => {
  const attendance = await readAttendance()
  return attendance.filter((record) => record.sessionId === sessionId)
}

export const listSessionsByClass = async (classId) => {
  const sessions = await readSessions()
  return sessions.filter((session) => session.classId === classId)
}

export const listAttendanceDetailed = async (sessionId) => {
  const [students, attendance] = await Promise.all([
    readStudents(),
    readAttendance(),
  ])
  const records = attendance.filter((record) => record.sessionId === sessionId)

  return records.map((record) => {
    const student = students.find((user) => user.id === record.studentId)
    return {
      ...record,
      student: student
        ? { id: student.id, name: student.name, roll: student.roll }
        : { id: record.studentId, name: 'Unknown', roll: '' },
    }
  })
}

export const listStudentAttendanceSummary = async (studentId) => {
  const [students, sessions, attendance] = await Promise.all([
    readStudents(),
    readSessions(),
    readAttendance(),
  ])
  const student = students.find((user) => user.id === studentId)
  if (!student || !student.classId) return []

  const classSessions = sessions.filter((session) => session.classId === student.classId)
  const attendanceSet = new Set(
    attendance
      .filter((record) => record.studentId === studentId)
      .map((record) => record.sessionId),
  )

  return classSessions.map((session) => ({
    id: session.id,
    subject: session.subject,
    timing: session.timing,
    date: session.date,
    status: session.status,
    present: attendanceSet.has(session.id),
  }))
}

export const getStudentById = async (studentId) => {
  const students = await readStudents()
  return students.find((user) => user.id === studentId) || null
}

// --- Teacher management ---

export const listTeachers = async () => {
  const teachers = await readTeachers()
  return teachers
    .filter((user) => user.role === 'TEACHER')
    .map(({ password, ...teacher }) => teacher)
}

export const approveTeacher = async (teacherId) => {
  const teachers = await readTeachers()
  const index = teachers.findIndex((user) => user.id === teacherId && user.role === 'TEACHER')
  if (index === -1) return null

  const teacher = teachers[index]
  teacher.approved = true
  await updateRow('Teachers', index, teacher)

  const { password, ...safeTeacher } = teacher
  return safeTeacher
}

// --- System activity ---

export const getSystemActivity = async () => {
  const [teachers, students, classes, sessions, attendance] = await Promise.all([
    readTeachers(),
    readStudents(),
    readClasses(),
    readSessions(),
    readAttendance(),
  ])

  const teacherList = teachers.filter((user) => user.role === 'TEACHER')
  const activeSessions = sessions.filter((session) => session.status === 'open')

  return {
    totals: {
      teachers: teacherList.length,
      approvedTeachers: teacherList.filter((teacher) => teacher.approved).length,
      pendingTeachers: teacherList.filter((teacher) => !teacher.approved).length,
      students: students.length,
      classes: classes.length,
      sessions: sessions.length,
      activeSessions: activeSessions.length,
      attendanceRecords: attendance.length,
    },
    recentSessions: sessions
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 5),
  }
}

// --- QR Sessions ---

export const createQrSession = async (payload) => {
  await appendRow('QrSessions', {
    ...payload,
    attendance: payload.attendance || [],
  })
  return payload
}

export const findQrSessionById = async (sessionId) => {
  const sessions = await readQrSessions()
  return sessions.find((session) => session.id === sessionId) || null
}

export const saveQrSession = async (session) => {
  const sessions = await readQrSessions()
  const index = sessions.findIndex((item) => item.id === session.id)
  if (index === -1) return null

  await updateRow('QrSessions', index, session)
  return session
}
