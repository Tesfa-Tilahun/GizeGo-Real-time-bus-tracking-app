/** Pick the stop closest to the passenger and its live ETA. */
export function pickStopEtaForUser(stopEtas, userCoords) {
  if (!stopEtas?.length) return { etaMinutes: null, stopName: null, stopId: null };

  let best = stopEtas[0];
  if (!userCoords) {
    return {
      etaMinutes: best.etaMinutes ?? null,
      stopName: best.stopName ?? null,
      stopId: best.stopId ?? null,
    };
  }

  let bestDist = Infinity;
  for (const stop of stopEtas) {
    if (stop.latitude == null || stop.longitude == null) continue;
    const d = haversineMeters(userCoords, {
      latitude: stop.latitude,
      longitude: stop.longitude,
    });
    if (d < bestDist) {
      bestDist = d;
      best = stop;
    }
  }

  return {
    etaMinutes: best.etaMinutes ?? null,
    stopName: best.stopName ?? null,
    stopId: best.stopId ?? null,
  };
}

function haversineMeters(a, b) {
  const R = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
