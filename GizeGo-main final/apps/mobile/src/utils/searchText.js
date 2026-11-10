const PLACE_ALIASES = new Map([
  ["shiromeda", { compact: "shiromeda", label: "Shiro Meda" }],
  ["shiromida", { compact: "shiromeda", label: "Shiro Meda" }],
  ["shromeda", { compact: "shiromeda", label: "Shiro Meda" }],
  ["sheromeda", { compact: "shiromeda", label: "Shiro Meda" }],
  ["kinggeorge", { compact: "4kilo", label: "4 Kilo" }],
  ["kinggeorgevi", { compact: "4kilo", label: "4 Kilo" }],
  ["kinggeorgestreet", { compact: "4kilo", label: "4 Kilo" }],
  ["kinggeorgest", { compact: "4kilo", label: "4 Kilo" }],
  ["aratkilo", { compact: "4kilo", label: "4 Kilo" }],
  ["aratekilo", { compact: "4kilo", label: "4 Kilo" }],
  ["fourkilo", { compact: "4kilo", label: "4 Kilo" }],
  ["አራትኪሎ", { compact: "4kilo", label: "4 Kilo" }],
  ["mexicosquare", { compact: "mexico", label: "Mexico" }],
  ["mexco", { compact: "mexico", label: "Mexico" }],
  ["ሜክሲኮ", { compact: "mexico", label: "Mexico" }],
  ["piazza", { compact: "piassa", label: "Piassa" }],
  ["piaza", { compact: "piassa", label: "Piassa" }],
  ["piasa", { compact: "piassa", label: "Piassa" }],
  ["ፒያሳ", { compact: "piassa", label: "Piassa" }],
  ["megenagnaroundabout", { compact: "megenagna", label: "Megenagna" }],
  ["megenanya", { compact: "megenagna", label: "Megenagna" }],
  ["megenagnasquare", { compact: "megenagna", label: "Megenagna" }],
  ["መገናኛ", { compact: "megenagna", label: "Megenagna" }],
  ["jemo", { compact: "jemo", label: "Jemo 2" }],
  ["jemo1", { compact: "jemo", label: "Jemo 2" }],
  ["jemo2", { compact: "jemo", label: "Jemo 2" }],
  ["bole", { compact: "boleroad", label: "Bole" }],
  ["boleroad", { compact: "boleroad", label: "Bole" }],
  ["cmc", { compact: "cmc", label: "CMC" }],
  ["merkato", { compact: "merkato", label: "Merkato" }],
  ["mercato", { compact: "merkato", label: "Merkato" }],
]);

export function normalizeSearchText(value) {
  const normalized = String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");
  return normalized;
}

export function compactSearchText(value) {
  const compact = normalizeSearchText(value).replace(/\s+/g, "");
  return PLACE_ALIASES.get(compact)?.compact ?? compact;
}

export function canonicalPlaceName(value) {
  const normalized = normalizeSearchText(value);
  const compact = normalized.replace(/\s+/g, "");
  return PLACE_ALIASES.get(compact)?.label ?? String(value ?? "").trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}

export function searchTextMatches(candidate, query) {
  const q = normalizeSearchText(query);
  const c = normalizeSearchText(candidate);
  if (!q) return true;
  if (!c) return false;
  if (c.includes(q) || q.includes(c)) return true;

  const compactQuery = compactSearchText(query);
  const compactCandidate = compactSearchText(candidate);
  if (compactCandidate.includes(compactQuery) || compactQuery.includes(compactCandidate)) {
    return true;
  }

  const maxDistance = compactQuery.length <= 6 ? 1 : 2;
  return levenshtein(compactCandidate, compactQuery) <= maxDistance;
}
