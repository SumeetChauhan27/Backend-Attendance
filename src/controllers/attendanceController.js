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
