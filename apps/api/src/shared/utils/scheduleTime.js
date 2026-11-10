/** Minutes from now until the next occurrence of HH:mm (24h). */
export function minutesUntilHHmm(hhmm, now = new Date()) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm ?? "").trim());
  if (!m) return null;
  const target = new Date(now);
  target.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  return Math.max(0, Math.round((target - now) / 60000));
}

export function formatPgTimeHHmm(pgTime) {
  if (pgTime == null || pgTime === "") return undefined;
  const s = typeof pgTime === "string" ? pgTime : String(pgTime);
  return s.length >= 5 ? s.slice(0, 5) : s;
}
