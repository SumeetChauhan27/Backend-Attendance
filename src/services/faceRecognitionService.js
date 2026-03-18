export const sanitizeFaceEmbedding = (descriptor) =>
  Array.isArray(descriptor) ? descriptor.map(Number) : []

export const toStudentFaceEmbeddingPayload = (user) => ({
  studentId: user.id,
  descriptor: sanitizeFaceEmbedding(user.faceEmbedding),
})
