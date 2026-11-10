export function normalizeEmail(value) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function normalizePhone(value) {
  const normalized = value?.trim().replace(/\s+/g, "");
  return normalized ? normalized : null;
}
