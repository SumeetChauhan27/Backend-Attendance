import { getUserById, getUserByLogin, listClasses } from '../db.js'

const tokenStore = new Map()
const tokenExpiryMs = 1000 * 60 * 60 * 8

const normalizeRoles = (roles) => {
  if (!roles) return null
  return Array.isArray(roles) ? roles : [roles]
}

export const issueToken = (userId, role) => {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
  tokenStore.set(token, { userId, role, expiresAt: Date.now() + tokenExpiryMs })
  return token
}

export const requireAuth = (roles) => (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.replace('Bearer ', '')
  const entry = tokenStore.get(token)

  if (!entry || Date.now() > entry.expiresAt) {
    res.status(401).send('Unauthorized')
    return
  }

  const allowedRoles = normalizeRoles(roles)
  if (allowedRoles && !allowedRoles.includes(entry.role)) {
    res.status(403).send('Forbidden')
    return
  }

  req.auth = entry
  next()
}

export const login = async (req, res) => {
  const { role, id, password } = req.body ?? {}
  if (!role || !id || !password) {
    res.status(400).send('Role, ID, and password are required')
    return
  }

  const user = await getUserByLogin(id)
  if (!user || user.role !== role || user.password !== password) {
    res.status(401).send('Invalid credentials')
    return
  }

  if (user.role === 'TEACHER' && !user.approved) {
    res.status(403).send('Teacher account is pending approval')
    return
  }

  const token = issueToken(user.id, user.role)
  res.json({ token, role: user.role, id: user.id })
}

export const logout = async (req, res) => {
  const header = req.headers.authorization || ''
  const token = header.replace('Bearer ', '')
  if (tokenStore.has(token)) {
    tokenStore.delete(token)
  }
  res.json({ ok: true })
}

export const getMe = async (req, res) => {
  const user = await getUserById(req.auth.userId)
  if (!user) {
    res.status(404).send('User not found')
    return
  }

  const classes = await listClasses()
  const className = classes.find((item) => item.id === user.classId)?.name ?? ''

  res.json({
    id: user.id,
    role: user.role,
    name: user.name,
    roll: user.roll,
    classId: user.classId,
    className,
    department: user.department,
    approved: user.approved,
  })
}
