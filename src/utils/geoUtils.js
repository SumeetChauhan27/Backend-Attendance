/**
 * Haversine formula — calculates the great-circle distance between two
 * latitude/longitude points on the Earth's surface.
 *
 * @param {number} lat1  Latitude of point 1 (degrees)
 * @param {number} lng1  Longitude of point 1 (degrees)
 * @param {number} lat2  Latitude of point 2 (degrees)
 * @param {number} lng2  Longitude of point 2 (degrees)
 * @returns {number}     Distance in metres
 */
export const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6_371_000 // Earth radius in metres
  const toRad = (deg) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Check whether a student location falls within the allowed radius of the
 * classroom location.
 *
 * @param {{ lat: number, lng: number }} studentLoc
 * @param {{ lat: number, lng: number }} classroomLoc
 * @param {number} [maxMetres=100]
 * @returns {boolean}
 */
export const isWithinRadius = (studentLoc, classroomLoc, maxMetres = 100) => {
  if (
    !studentLoc?.lat ||
    !studentLoc?.lng ||
    !classroomLoc?.lat ||
    !classroomLoc?.lng
  ) {
    // If either location is missing, skip geo-check (graceful fallback).
    return true
  }

  const distance = haversineDistance(
    studentLoc.lat,
    studentLoc.lng,
    classroomLoc.lat,
    classroomLoc.lng,
  )

  return distance <= maxMetres
}
