import cors from 'cors'
import express from 'express'
import compression from 'compression'
import authRoutes, { meRoute } from './routes/authRoutes.js'
import attendanceRoutes from './routes/attendanceRoutes.js'
import studentRoutes from './routes/studentRoutes.js'
import teacherRoutes from './routes/teacherRoutes.js'
import { initDb, seedSuperAdmin, seedTeacher } from './db.js'
import { refreshCache, startCacheRefresh } from './services/embeddingCache.js'

const app = express()

// --- Middleware ---
// Gzip compress all responses to save bandwidth
app.use(compression())

// Lock CORS to the deployed frontend URL (falls back to permissive for local dev)
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : true // allow all in dev when env var is not set

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}))

app.use(express.json({ limit: '2mb' }))

// Health check endpoint — keeps Render from spinning down & shows server is alive
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))

// --- Routes ---
app.use('/api/auth', authRoutes)
app.use('/api', meRoute)
app.use('/api', teacherRoutes)
app.use('/api', studentRoutes)
app.use('/api', attendanceRoutes)

// --- DB Setup (called from server.js before listen) ---
export const setupDb = async () => {
  const superAdminId = process.env.SUPER_ADMIN_ID || 'admin'
  const superAdminPass = process.env.SUPER_ADMIN_PASS || 'admin123'
  const teacherId = process.env.TEACHER_ID || 'teacher1'
  const teacherPass = process.env.TEACHER_PASS || 'teacher123'

  try {
    await initDb()
    await seedSuperAdmin(superAdminId, superAdminPass)
    await seedTeacher(teacherId, teacherPass)
    console.log('Database seeded successfully')

    // Load face embeddings into memory
    await refreshCache()
    startCacheRefresh()
  } catch (err) {
    console.error('Failed to initialize or seed database:', err)
  }
}

export default app
