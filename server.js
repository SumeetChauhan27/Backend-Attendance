import 'dotenv/config'
import app, { setupDb } from './src/app.js'

const PORT = process.env.PORT || 5000

// Initialize DB first, then start listening.
// This prevents requests from hitting the server before Google Sheets is ready.
;(async () => {
  try {
    console.log('Initializing database...')
    await setupDb()
    console.log('Database initialized.')
  } catch (err) {
    console.error('Startup error during DB init:', err)
    // Continue anyway — server can still serve non-DB routes (e.g. /health)
  }

  app.listen(PORT, () => {
    console.log(`Attendance API is live and listening on port ${PORT}`)
    console.log(`Ready to accept requests from frontend.`)
  })
})()
