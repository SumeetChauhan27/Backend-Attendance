/**
 * Face recognition utilities for the backend.
 *
 * Provides cosine similarity, best-match finding, and
 * payload formatting for student face embeddings.
 */

const DESCRIPTOR_LENGTH = 128

export const sanitizeFaceEmbedding = (descriptor) =>
  Array.isArray(descriptor) ? descriptor.map(Number) : []

export const toStudentFaceEmbeddingPayload = (user) => ({
  studentId: user.id,
  descriptor: sanitizeFaceEmbedding(user.faceEmbedding),
})

/**
 * Normalize a vector to magnitude 1.
 */
export const normalize = (vec) => {
  const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  if (mag === 0) return vec
  return vec.map((v) => v / mag)
}

/**
 * Cosine similarity between two numeric arrays.
 * Returns a value in [0, 1] where 1 = identical.
 */
export const cosineSimilarity = (a, b) => {
  if (a.length !== b.length) return 0

  const normA = normalize(a)
  const normB = normalize(b)
  
  let dotProduct = 0
  for (let i = 0; i < normA.length; i++) {
    dotProduct += normA[i] * normB[i]
  }

  // Since vectors are normalized, denominator is 1. We clamp just in case.
  return Math.min(Math.max(dotProduct, -1), 1)
}

/**
 * Find the best matching student from an array of stored embeddings.
 *
 * @param {number[]} inputDescriptor  128-value face descriptor from the live capture
 * @param {{ studentId: string, name?: string, embeddings: number[][] }[]} studentsData
 * @param {number} [threshold=0.55]   Minimum similarity to accept as a match
 * @returns {{ studentId: string|null, name: string, similarity: number, status: 'accepted'|'retry'|'rejected' }}
 */
export const findBestMatch = (inputDescriptor, studentsData, threshold = 0.55) => {
  if (
    !inputDescriptor ||
    inputDescriptor.length !== DESCRIPTOR_LENGTH ||
    !studentsData.length
  ) {
    return { studentId: null, name: '', similarity: 0, status: 'rejected' }
  }

  let bestStudentId = null
  let bestName = ''
  let bestSimilarity = 0

  for (const student of studentsData) {
    if (!student.embeddings || !Array.isArray(student.embeddings)) continue

    for (const emb of student.embeddings) {
      if (!emb || emb.length !== DESCRIPTOR_LENGTH) continue

      const similarity = cosineSimilarity(inputDescriptor, emb)
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestStudentId = student.studentId
        bestName = student.name || ''
      }
    }
  }

  let status = 'rejected'
  if (bestSimilarity >= threshold) {
    status = 'accepted'
  } else if (bestSimilarity >= 0.50) {
    status = 'retry'
  }

  return { studentId: bestStudentId, name: bestName, similarity: bestSimilarity, status }
}
