import { findBestMatch } from '../services/faceRecognitionService.js'
import { getEmbeddings } from '../services/embeddingCache.js'

export const matchFace = (req, res) => {
  const { descriptor } = req.body

  if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
    res.status(400).send('Valid 128-value face descriptor is required')
    return
  }

  const cachedStudents = getEmbeddings()
  if (!cachedStudents || cachedStudents.length === 0) {
    res.status(503).send('Face embeddings cache is empty or unavailable')
    return
  }

  try {
    const matchResult = findBestMatch(descriptor, cachedStudents)
    res.json(matchResult)
  } catch (error) {
    console.error('Face match error:', error)
    res.status(500).send('Internal server error during face matching')
  }
}
