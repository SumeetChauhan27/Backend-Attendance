import 'dotenv/config'
import app, { setupDb } from './src/app.js'

const PORT = process.env.PORT || 5000

app.listen(PORT, async () => {
  console.log(`Attendance API running on http://localhost:${PORT}`)
  await setupDb()
})
