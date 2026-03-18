import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
  scopes: SCOPES,
})

const sheets = google.sheets({ version: 'v4', auth })
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID

// Tab definitions with header rows
const TABS = {
  Teachers: ['id', 'name', 'email', 'password', 'department', 'role', 'approved', 'roll', 'classId'],
  Students: ['id', 'name', 'roll', 'rollNumber', 'classId', 'department', 'year', 'password', 'faceEmbedding'],
  Classes: ['id', 'name'],
  Sessions: ['id', 'classId', 'subject', 'timing', 'date', 'status', 'createdAt', 'closedAt'],
  Attendance: ['id', 'sessionId', 'studentId', 'timestamp'],
  QrSessions: ['id', 'classId', 'subject', 'room', 'startTime', 'expiryTime', 'token', 'status', 'attendance', 'classroomLat', 'classroomLng'],
  AttendanceLogs: ['id', 'sessionId', 'studentId', 'ip', 'userAgent', 'lat', 'lng', 'faceVerified', 'locationVerified', 'timestamp', 'result'],
}

/**
 * Ensure all required tabs exist with their header rows.
 */
export const initSheets = async () => {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const existingTabs = new Set(
    (spreadsheet.data.sheets || []).map((s) => s.properties?.title),
  )

  const requests = []
  for (const tabName of Object.keys(TABS)) {
    if (!existingTabs.has(tabName)) {
      requests.push({ addSheet: { properties: { title: tabName } } })
    }
  }

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests },
    })
  }

  // Set header rows for any empty tabs
  for (const [tabName, headers] of Object.entries(TABS)) {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A1:1`,
    })
    if (!existing.data.values || existing.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tabName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      })
    }
  }

  // Remove default "Sheet1" if other tabs exist
  const updatedSpreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const allSheets = updatedSpreadsheet.data.sheets || []
  const sheet1 = allSheets.find((s) => s.properties?.title === 'Sheet1')
  if (sheet1 && allSheets.length > 1) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ deleteSheet: { sheetId: sheet1.properties?.sheetId } }],
        },
      })
    } catch {
      // Ignore if it can't be deleted (e.g., it's the only sheet)
    }
  }
}

/**
 * Read all rows from a tab, returning array of objects keyed by header.
 */
export const getRows = async (tabName) => {
  const headers = TABS[tabName]
  if (!headers) throw new Error(`Unknown tab: ${tabName}`)

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A:${columnLetter(headers.length)}`,
  })

  const rows = result.data.values || []
  if (rows.length <= 1) return [] // Only header or empty

  return rows.slice(1).map((row) => {
    const obj = {}
    headers.forEach((key, i) => {
      obj[key] = deserializeCell(key, row[i])
    })
    return obj
  })
}

/**
 * Append a row to a tab.
 */
export const appendRow = async (tabName, obj) => {
  const headers = TABS[tabName]
  if (!headers) throw new Error(`Unknown tab: ${tabName}`)

  const row = headers.map((key) => serializeCell(key, obj[key]))

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A:${columnLetter(headers.length)}`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  })
}

/**
 * Update a specific row (1-indexed data row, excluding header).
 * dataRowIndex is 0-based (first data row = 0).
 */
export const updateRow = async (tabName, dataRowIndex, obj) => {
  const headers = TABS[tabName]
  if (!headers) throw new Error(`Unknown tab: ${tabName}`)

  const sheetRow = dataRowIndex + 2 // +1 for header, +1 for 1-indexed
  const row = headers.map((key) => serializeCell(key, obj[key]))

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A${sheetRow}:${columnLetter(headers.length)}${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  })
}

/**
 * Delete a specific data row (0-based index).
 */
export const deleteRow = async (tabName, dataRowIndex) => {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const sheet = (spreadsheet.data.sheets || []).find(
    (s) => s.properties?.title === tabName,
  )
  if (!sheet) return

  const sheetId = sheet.properties?.sheetId
  const sheetRow = dataRowIndex + 1 // +1 for header (0-based for API)

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: sheetRow,
              endIndex: sheetRow + 1,
            },
          },
        },
      ],
    },
  })
}

/**
 * Overwrite all data rows (keeps header row).
 */
export const setAllRows = async (tabName, objects) => {
  const headers = TABS[tabName]
  if (!headers) throw new Error(`Unknown tab: ${tabName}`)

  // Clear everything below header
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A2:${columnLetter(headers.length)}`,
  })

  if (objects.length === 0) return

  const rows = objects.map((obj) =>
    headers.map((key) => serializeCell(key, obj[key])),
  )

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A2`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  })
}

// --- Helpers ---

const columnLetter = (num) => {
  let letter = ''
  let n = num
  while (n > 0) {
    n -= 1
    letter = String.fromCharCode(65 + (n % 26)) + letter
    n = Math.floor(n / 26)
  }
  return letter
}

const JSON_FIELDS = new Set(['faceEmbedding', 'attendance'])
const BOOLEAN_FIELDS = new Set(['approved'])
const NUMBER_FIELDS = new Set(['startTime', 'expiryTime', 'classroomLat', 'classroomLng', 'lat', 'lng'])

const serializeCell = (key, value) => {
  if (value === undefined || value === null) return ''
  if (JSON_FIELDS.has(key)) return JSON.stringify(value)
  if (BOOLEAN_FIELDS.has(key)) return String(value)
  if (NUMBER_FIELDS.has(key)) return String(value)
  return String(value)
}

const deserializeCell = (key, value) => {
  if (value === undefined || value === '') return null
  if (JSON_FIELDS.has(key)) {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  if (BOOLEAN_FIELDS.has(key)) return value === 'true'
  if (NUMBER_FIELDS.has(key)) {
    const num = Number(value)
    return Number.isNaN(num) ? null : num
  }
  return value
}
