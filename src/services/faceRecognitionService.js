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

export const findBestMatch = (inputDescriptor, studentsData, threshold = 0.65) => {
  if (
    !inputDescriptor ||
    inputDescriptor.length !== DESCRIPTOR_LENGTH ||
    !studentsData.length
  ) {
    return { studentId: null, name: '', similarity: 0, status: 'rejected' }
  }

  const current = normalize(sanitizeFaceEmbedding(inputDescriptor))
  let matches = []

  for (const student of studentsData) {
    let bestForStudent = 0

    // Compare against average embedding if available
    if (student.averageEmbedding && Array.isArray(student.averageEmbedding) && student.averageEmbedding.length === DESCRIPTOR_LENGTH) {
      const avgScore = cosineSimilarity(current, student.averageEmbedding)
      bestForStudent = Math.max(bestForStudent, avgScore)
    }

    // Compare against all raw samples
    if (student.embeddings && Array.isArray(student.embeddings)) {
      for (const emb of student.embeddings) {
        if (!emb || emb.length !== DESCRIPTOR_LENGTH) continue

        const similarity = cosineSimilarity(current, emb)
        bestForStudent = Math.max(bestForStudent, similarity)
      }
    }
    
    matches.push({ studentId: student.studentId, name: student.name || '', score: bestForStudent })
  }

  // Sort matches descending
  matches.sort((a, b) => b.score - a.score)
  
  const bestMatch = matches[0]
  const secondBestMatch = matches.length > 1 ? matches[1] : null

  console.log(`[Face Match] Best: ${bestMatch.score.toFixed(3)} (${bestMatch.studentId}), Second: ${secondBestMatch ? secondBestMatch.score.toFixed(3) : 'N/A'}`)

  // Ambiguity check: prevent cross-matches for similar faces
  if (secondBestMatch && (bestMatch.score - secondBestMatch.score < 0.05) && bestMatch.score < 0.8) {
    console.warn(`[Face Match] Rejected due to ambiguity (gap < 0.05). Best: ${bestMatch.score.toFixed(3)}, Second: ${secondBestMatch.score.toFixed(3)}`)
    return { studentId: null, name: '', similarity: bestMatch.score, status: 'rejected' }
  }

  let status = 'rejected'
  if (bestMatch.score >= threshold) {
    status = 'accepted'
  } else if (bestMatch.score >= 0.55) {
    status = 'retry'
  }

  return { studentId: bestMatch.studentId, name: bestMatch.name, similarity: bestMatch.score, status }
}
