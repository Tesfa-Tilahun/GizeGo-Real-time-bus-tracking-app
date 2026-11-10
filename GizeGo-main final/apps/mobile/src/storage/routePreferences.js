import AsyncStorage from "@react-native-async-storage/async-storage";

const RECENT_KEY = "@gizego/recent-trips";
const FAVORITES_KEY = "@gizego/favorite-routes";
const MAX_RECENT = 8;
const MAX_FAVORITES = 24;

function tripKey(trip) {
  const from = trip.fromUseCurrent ? "__gps__" : (trip.fromLabel ?? "").trim().toLowerCase();
  const to = (trip.toLabel ?? "").trim().toLowerCase();
  return `${from}|${to}`;
}

export async function loadRecentTrips() {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** @param {{ fromLabel: string, toLabel: string, fromUseCurrent?: boolean, fromLat?: number, fromLng?: number, routeId?: string, routeName?: string }} trip */
export async function addRecentTrip(trip) {
  if (!trip?.toLabel?.trim()) return loadRecentTrips();
  const entry = {
    id: tripKey(trip),
    fromLabel: trip.fromLabel ?? "",
    toLabel: trip.toLabel.trim(),
    fromUseCurrent: Boolean(trip.fromUseCurrent),
    fromLat: trip.fromLat ?? null,
    fromLng: trip.fromLng ?? null,
    routeId: trip.routeId ?? null,
    routeName: trip.routeName ?? null,
    searchedAt: new Date().toISOString(),
  };
  const prev = await loadRecentTrips();
  const next = [entry, ...prev.filter((t) => t.id !== entry.id)].slice(0, MAX_RECENT);
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export async function loadFavoriteRoutes() {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** @param {{ id: string, name: string, code?: string, price?: number, distanceMeters?: number }} route */
export async function addFavoriteRoute(route) {
  if (!route?.id) return loadFavoriteRoutes();
  const entry = {
    routeId: route.id,
    name: route.name ?? "",
    code: route.code ?? null,
    price: route.price ?? null,
    distanceMeters: route.distanceMeters ?? null,
    savedAt: new Date().toISOString(),
  };
  const prev = await loadFavoriteRoutes();
  if (prev.some((f) => f.routeId === entry.routeId)) return prev;
  const next = [entry, ...prev].slice(0, MAX_FAVORITES);
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return next;
}

export async function removeFavoriteRoute(routeId) {
  const prev = await loadFavoriteRoutes();
  const next = prev.filter((f) => f.routeId !== routeId);
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return next;
}

export async function toggleFavoriteRoute(route) {
  if (!route?.id) return { favorites: await loadFavoriteRoutes(), added: false };
  const prev = await loadFavoriteRoutes();
  if (prev.some((f) => f.routeId === route.id)) {
    const favorites = await removeFavoriteRoute(route.id);
    return { favorites, added: false };
  }
  const favorites = await addFavoriteRoute(route);
  return { favorites, added: true };
}

export function isFavoriteRouteId(favorites, routeId) {
  return favorites.some((f) => f.routeId === routeId);
}
