/** Format distance as kilometers with one decimal (e.g. "12.4"). */
export function formatKmOneDecimal(distanceMeters) {
  if (distanceMeters == null || Number.isNaN(distanceMeters)) return null;
  return (distanceMeters / 1000).toFixed(1);
}

/**
 * Rough travel time along the stored route (not live traffic).
 * @param {number} kmh - Typical urban transit speed (~22 km/h default).
 */
export function estimateMinutesFromDistanceMeters(meters, kmh = 22) {
  if (meters == null || meters <= 0 || Number.isNaN(meters)) return null;
  const hours = meters / 1000 / kmh;
  return Math.max(1, Math.round(hours * 60));
}

/** e.g. 105 → "1h 45m" */
export function formatDurationHm(totalMinutes) {
  if (totalMinutes == null || totalMinutes <= 0) return "";
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Minutes between HH:mm strings (handles next-day arrival). */
export function minutesBetweenHHmm(dep, arr) {
  if (!dep || !arr) return null;
  const dp = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(dep).trim());
  const ap = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(arr).trim());
  if (!dp || !ap) return null;
  let start = Number(dp[1]) * 60 + Number(dp[2]);
  let end = Number(ap[1]) * 60 + Number(ap[2]);
  if (end < start) end += 24 * 60;
  return Math.max(0, end - start);
}
