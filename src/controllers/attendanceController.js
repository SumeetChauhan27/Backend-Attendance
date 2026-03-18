import crypto from 'node:crypto'
import {
  closeSession,
  createQrSession,
  findQrSessionById,
  getActiveSession,
  getSessionById,
  getStudentById,
  listAttendanceBySession,
  listAttendanceDetailed,
  listSessionsByClass,
  listStudentsByClass,
  markAttendance,
  openSession,
  saveQrSession,
} from '../db.js'

export const health = (_req, res) => {
  res.json({ ok: true })
}

export const openClassSession = async (req, res) => {
  const { classId, subject, timing } = req.body ?? {}
  if (!classId || !subject || !timing) {
    res.status(400).send('Class, subject, and timing required')
    return
  }

  res.json(await openSession({ classId, subject, timing }))
}

export const startQrSession = async (req, res) => {
  try {
    const { classId, subject, room = '' } = req.body ?? {}
    if (!classId || !subject) {
      res.status(400).json({ message: 'invalid request' })
      return
    }

    const startTime = Date.now()
    const expiryTime = startTime + 5 * 60 * 1000
    const sessionId = crypto.randomUUID()
    const token = crypto.randomBytes(32).toString('hex')

    await createQrSession({
      id: sessionId,
      classId,
      subject,
      room,
      startTime,
      expiryTime,
      token,
      status: 'ACTIVE',
      attendance: [],
    })

    res.json({
      sessionId,
      token,
      expiresAt: expiryTime,
    })
  } catch {
    res.status(500).json({ message: 'internal server error' })
  }
}

export const closeClassSession = async (req, res) => {
  const { sessionId } = req.body ?? {}
  if (!sessionId) {
    res.status(400).send('Session ID required')
    return
  }

  const updated = await closeSession(sessionId)
  if (!updated) {
    res.status(404).send('Session not found')
    return
  }

  res.json(updated)
}

export const getActiveClassSession = async (req, res) => {
  const session = await getActiveSession(req.params.classId)
  res.json(session ?? null)
}

export const listSessionAttendance = async (req, res) => {
  res.json(await listAttendanceBySession(req.params.sessionId))
}

export const listSessionAttendanceDetails = async (req, res) => {
  res.json(await listAttendanceDetailed(req.params.sessionId))
}

export const listClassSessions = async (req, res) => {
  const sessions = await listSessionsByClass(req.params.classId)
  const attendance = await Promise.all(
    sessions.map(async (session) => {
      const records = await listAttendanceBySession(session.id)
      return { ...session, presentCount: records.length }
    }),
  )

  attendance.sort((a, b) => {
    const dateA = a.date || ''
    const dateB = b.date || ''
    if (dateA !== dateB) return dateB.localeCompare(dateA)
    return (b.createdAt || '').localeCompare(a.createdAt || '')
  })

  res.json(attendance)
}

export const markTeacherAttendanceByFace = async (req, res) => {
  const { studentId, sessionId } = req.body ?? {}
  if (!studentId || !sessionId) {
    res.status(400).send('Student ID and session ID are required')
    return
  }

  const student = await getStudentById(studentId)
  if (!student) {
    res.status(404).send('Student not found')
    return
  }

  const targetSession = await getSessionById(sessionId)
  if (!targetSession) {
    res.status(404).send('Session not found')
    return
  }

  if (targetSession.status !== 'open') {
    res.status(400).send('Session is not active')
    return
  }

  if (targetSession.classId !== student.classId) {
    res.status(400).send('Student does not belong to this session class')
    return
  }

  const record = await markAttendance({
    sessionId: targetSession.id,
    studentId: student.id,
  })
  res.json(record)
}

export const markAttendanceByQr = async (req, res) => {
  try {
    const { studentId, sessionId, token } = req.body ?? {}
    if (!studentId || !sessionId || !token) {
      res.status(400).json({ message: 'invalid request' })
      return
    }

    const session = await findQrSessionById(sessionId)
    if (!session) {
      res.status(404).json({ message: 'session not found' })
      return
    }

    if (session.status !== 'ACTIVE') {
      res.status(400).json({ message: 'invalid request' })
      return
    }

    if (session.token !== token) {
      res.status(401).json({ message: 'invalid token' })
      return
    }

    if (Date.now() >= session.expiryTime) {
      session.status = 'CLOSED'
      await saveQrSession(session)
      res.status(403).json({ message: 'expired session' })
      return
    }

    if (session.attendance.includes(studentId)) {
      res.status(409).json({ message: 'already marked' })
      return
    }

    session.attendance.push(studentId)
    await saveQrSession(session)
    res.json({ message: 'attendance marked' })
  } catch {
    res.status(500).json({ message: 'internal server error' })
  }
}

const escapeCsv = (value) => {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export const exportClassAttendanceCsv = async (req, res) => {
  try {
    const classId = req.params.classId
    if (!classId) {
      res.status(400).send('Class ID required')
      return
    }

    const [students, sessions, attendance] = await Promise.all([
      listStudentsByClass(classId),
      listSessionsByClass(classId),
      (async () => {
        const allSessions = await listSessionsByClass(classId)
        const records = []
        for (const session of allSessions) {
          const sessionRecords = await listAttendanceBySession(session.id)
          records.push(...sessionRecords)
        }
        return records
      })(),
    ])

    // Sort sessions by date then createdAt
    sessions.sort((a, b) => {
      const dateA = a.date || ''
      const dateB = b.date || ''
      if (dateA !== dateB) return dateA.localeCompare(dateB)
      return (a.createdAt || '').localeCompare(b.createdAt || '')
    })

    // Build attendance lookup: sessionId -> Set of studentIds
    const attendanceMap = new Map()
    attendance.forEach((record) => {
      if (!attendanceMap.has(record.sessionId)) {
        attendanceMap.set(record.sessionId, new Set())
      }
      attendanceMap.get(record.sessionId).add(record.studentId)
    })

    // Build CSV header
    const header = [
      'Roll Number',
      'Student Name',
      'Department',
      'Year',
      ...sessions.map((s) => `${s.subject} (${s.date} ${s.timing || ''})`),
      'Total Present',
      'Total Sessions',
      'Percentage',
    ]

    // Build CSV rows
    const rows = students.map((student) => {
      let presentCount = 0
      const sessionCells = sessions.map((session) => {
        const isPresent = attendanceMap.get(session.id)?.has(student.id)
        if (isPresent) presentCount += 1
        return isPresent ? 'P' : 'A'
      })

      const total = sessions.length
      const percentage = total ? Math.round((presentCount / total) * 100) : 0

      return [
        student.rollNumber || student.roll || student.id,
        student.name,
        student.department || '',
        student.year || '',
        ...sessionCells,
        presentCount,
        total,
        `${percentage}%`,
      ]
    })

    // Sort students by roll number
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])))

    const csvContent = [header, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance_${classId}_${new Date().toISOString().slice(0, 10)}.csv"`,
    )
    res.send(csvContent)
  } catch {
    res.status(500).send('Unable to export attendance')
  }
}
