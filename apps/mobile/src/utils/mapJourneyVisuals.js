import { pointAlongPath } from "./routePolyline.js";

/** Haversine distance in meters (for picking nearest stop). */
function distM(a, b) {
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

function nearestStopIndex(stops, coords) {
  if (!coords || !stops?.length) return 0;
  let best = 0;
  let bestD = Infinity;
  stops.forEach((s, i) => {
    const d = distM(coords, { latitude: s.latitude, longitude: s.longitude });
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function findStopIndexByLabel(stops, label) {
  if (!label?.trim() || !stops?.length) return -1;
  const q = label.trim().toLowerCase();
  if (q.includes("current location") || q.includes("የአሁኑ")) return -1;
  return stops.findIndex((s) => {
    const n = (s.name ?? "").toLowerCase();
    return n.includes(q) || q.includes(n);
  });
}

/**
 * Trip segment between departure and arrival stops (ordered by sequence).
 */
export function resolveTripSegment(stops, fromLabel, toLabel, userCoords) {
  if (!stops?.length) {
    return { departure: null, arrival: null, segment: [], depIdx: 0, arrIdx: 0 };
  }

  let depIdx = findStopIndexByLabel(stops, fromLabel);
  if (depIdx < 0 && userCoords) {
    depIdx = nearestStopIndex(stops, userCoords);
  }
  if (depIdx < 0) depIdx = 0;

  let arrIdx = findStopIndexByLabel(stops, toLabel);
  if (arrIdx < 0) arrIdx = stops.length - 1;

  if (depIdx > arrIdx) {
    const t = depIdx;
    depIdx = arrIdx;
    arrIdx = t;
  }

  const segment = stops.slice(depIdx, arrIdx + 1).map((s) => ({
    latitude: s.latitude,
    longitude: s.longitude,
  }));

  return {
    departure: stops[depIdx],
    arrival: stops[arrIdx],
    segment,
    depIdx,
    arrIdx,
  };
}

/** Query params for /tracking/routes/:id/optimize from trip context. */
export function buildOptimizeParams(tripVisual) {
  if (!tripVisual?.departure && !tripVisual?.arrival) return {};
  const params = {};
  if (tripVisual.departure?.id) params.fromStopId = tripVisual.departure.id;
  else if (tripVisual.departure) {
    params.fromLat = tripVisual.departure.latitude;
    params.fromLng = tripVisual.departure.longitude;
  }
  if (tripVisual.arrival?.id) params.toStopId = tripVisual.arrival.id;
  else if (tripVisual.arrival) {
    params.toLat = tripVisual.arrival.latitude;
    params.toLng = tripVisual.arrival.longitude;
  }
  return params;
}

/** Polyline from route start → bus position along the road path. */
export function pathFromRouteStartToBus(routeCoords, progress) {
  if (!routeCoords?.length) return [];
  const sample = pointAlongPath(routeCoords, progress ?? 0);
  if (!sample?.point) return [];

  const p = Math.max(0, Math.min(1, progress ?? 0));
  if (p <= 0) return [routeCoords[0]];

  let total = 0;
  const segments = [];
  for (let i = 1; i < routeCoords.length; i++) {
    const len = distM(routeCoords[i - 1], routeCoords[i]);
    segments.push({ index: i, start: total, length: len });
    total += len;
  }
  if (total <= 0) return [routeCoords[0], sample.point];

  const targetDist = p * total;
  const out = [routeCoords[0]];
  for (const seg of segments) {
    if (seg.start + seg.length <= targetDist) {
      out.push(routeCoords[seg.index]);
    } else {
      out.push(sample.point);
      break;
    }
  }
  if (out.length === 1) out.push(sample.point);
  return out;
}

/** Straight line bus → passenger (approach to you). */
export function lineBusToUser(bus, userCoords) {
  if (!bus || !userCoords) return [];
  return [
    { latitude: bus.latitude, longitude: bus.longitude },
    { latitude: userCoords.latitude, longitude: userCoords.longitude },
  ];
}

/** Pick the live bus closest to the user. */
export function nearestLiveBus(buses, userCoords) {
  if (!buses?.length || !userCoords) return buses[0] ?? null;
  let best = buses[0];
  let bestD = distM(userCoords, best);
  for (let i = 1; i < buses.length; i++) {
    const d = distM(userCoords, buses[i]);
    if (d < bestD) {
      bestD = d;
      best = buses[i];
    }
  }
  return best;
}
