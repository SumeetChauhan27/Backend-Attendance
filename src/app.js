import cors from 'cors'
import express from 'express'
import authRoutes, { meRoute } from './routes/authRoutes.js'
import attendanceRoutes from './routes/attendanceRoutes.js'
import studentRoutes from './routes/studentRoutes.js'
import teacherRoutes from './routes/teacherRoutes.js'
import { initDb, seedSuperAdmin, seedTeacher } from './db.js'

const superAdminId = process.env.SUPER_ADMIN_ID || 'admin'
const superAdminPass = process.env.SUPER_ADMIN_PASS || 'admin123'
const teacherId = process.env.TEACHER_ID || 'teacher1'
const teacherPass = process.env.TEACHER_PASS || 'teacher123'

await initDb()
await seedSuperAdmin(superAdminId, superAdminPass)
await seedTeacher(teacherId, teacherPass)

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api', meRoute)
app.use('/api', teacherRoutes)
app.use('/api', studentRoutes)
app.use('/api', attendanceRoutes)

export default app
