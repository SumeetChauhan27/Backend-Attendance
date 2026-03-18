import {
  createClass,
  createStudent,
  deleteStudent,
  listClasses,
  listStudentsByClass,
  listStudentsWithAttendance,
  updateStudent,
} from '../db.js'

export const listSpreadsheetClasses = () => listClasses()

export const createSpreadsheetClass = (name) => createClass(name)

export const listSpreadsheetStudents = (classId) => listStudentsByClass(classId)

export const listSpreadsheetStudentsWithAttendance = (classId) =>
  listStudentsWithAttendance(classId)

export const createSpreadsheetStudent = (payload) => createStudent(payload)

export const updateSpreadsheetStudent = (studentId, payload) =>
  updateStudent(studentId, payload)

export const removeSpreadsheetStudent = (studentId) => deleteStudent(studentId)
