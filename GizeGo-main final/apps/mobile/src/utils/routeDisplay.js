import { normalizeSearchText, searchTextMatches } from "./searchText.js";

/** Infer operator from route code (A* = Ambessa, AB* = Addis Bus). */
export function operatorFromCode(code) {
  if (!code) return { id: "addis", badge: "ABO", label: "Addis" };
  if (code.startsWith("AB")) return { id: "addis", badge: "ABO", label: "Addis" };
  return { id: "ambessa", badge: code.slice(0, 3), label: "Ambessa" };
}

export function filterRoutesByOperator(routes, operatorId) {
  if (!operatorId || operatorId === "all") return routes;
  if (operatorId === "shega") {
    return routes.filter((_, i) => i % 3 === 2);
  }
  return routes.filter((r) => operatorFromCode(r.code).id === operatorId);
}

export function filterRoutesByQuery(routes, q) {
  const query = normalizeSearchText(q);
  if (!query) return routes;
  return routes.filter(
    (r) =>
      searchTextMatches(r.name, query) ||
      searchTextMatches(r.code, query),
  );
}

export function formatRouteDuration(minutes) {
  if (minutes == null) return "—";
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}

export function formatRouteDistance(meters) {
  if (meters == null) return "—";
  return `${(meters / 1000).toFixed(1)} km`;
}
