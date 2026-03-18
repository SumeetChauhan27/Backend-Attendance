import 'dotenv/config'
import app, { setupDb } from './src/app.js'

const PORT = process.env.PORT || 5000

app.listen(PORT, async () => {
  console.log(`Attendance API is live and listening on port ${PORT}`)
  console.log(`Ready to accept requests from frontend.`)
  await setupDb()
})
