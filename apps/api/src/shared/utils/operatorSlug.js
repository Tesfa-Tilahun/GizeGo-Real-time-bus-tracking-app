/** Stable slug for operator id from display name (e.g. "Addis Bus" -> "addis_bus"). */
export function slugifyOperatorId(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}
