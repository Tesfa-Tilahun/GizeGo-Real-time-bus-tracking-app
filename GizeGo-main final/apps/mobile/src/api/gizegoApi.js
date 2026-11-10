import { API_BASE_URL } from "../config/api.js";

const REQUEST_TIMEOUT_MS = 25000;

let authToken = null;

/** Set JWT from AuthContext so authenticated API calls work. */
export function setAuthToken(token) {
  authToken = token || null;
}

async function parseJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  /* eslint-disable-next-line no-unused-vars */
  } catch (_e) {
    return { message: text || "Invalid response" };
  }
}

function errMessage(data, fallback) {
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors
      .map((e) => {
        let path = "";
        if (Array.isArray(e.path)) path = e.path.join(".");
        else if (e.path != null) path = String(e.path);
        return path ? `${path}: ${e.message}` : e.message;
      })
      .join("\n");
  }
  if (data?.message) return data.message;
  return fallback;
}

function mapNetworkError(err) {
  if (err?.name === "AbortError") {
    return new Error(`Request timed out. Check API is running and reachable at ${API_BASE_URL}`);
  }
  const msg = err?.message || "";
  if (
    msg.includes("Network request failed") ||
    msg.includes("Failed to fetch") ||
    err?.cause?.code === "ECONNREFUSED"
  ) {
    return new Error(
      `Cannot reach API at ${API_BASE_URL}.\n` +
        "• Start the backend: cd apps/api && npm run dev\n" +
        "• Phone: same Wi‑Fi as PC; Windows Firewall allow port 3000\n" +
        "• Set EXPO_PUBLIC_API_BASE_URL in .env if auto IP fails",
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * @param {string} path - e.g. "/api/v1/routes"
 * @param {RequestInit} [init]
 */
export async function apiFetch(path, init = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
    return res;
  } catch (e) {
    throw mapNetworkError(e);
  } finally {
    clearTimeout(timer);
  }
}

export async function translatePublic({ texts, source = "en", target = "am" }) {
  const res = await apiFetch("/api/v1/public/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, source, target }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Translation failed"));
  return data;
}

export async function searchRoutes(from, to, opts = {}) {
  const qs = new URLSearchParams();
  if (from?.trim()) qs.set("from", from.trim());
  qs.set("to", to.trim());
  if (opts.fromLat != null && Number.isFinite(opts.fromLat)) {
    qs.set("fromLat", String(opts.fromLat));
  }
  if (opts.fromLng != null && Number.isFinite(opts.fromLng)) {
    qs.set("fromLng", String(opts.fromLng));
  }
  const res = await apiFetch(`/api/v1/search/routes?${qs.toString()}`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Search failed"));
  return data;
}

export async function searchLocations(q) {
  const path = `/api/v1/search/locations?q=${encodeURIComponent(q.trim())}`;
  const res = await apiFetch(path);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Location search failed"));
  return data;
}

export async function fetchRouteById(routeId) {
  const res = await apiFetch(`/api/v1/routes/${routeId}`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not load route details"));
  return data;
}

export async function fetchMapPois(q) {
  const path = q?.trim()
    ? `/api/v1/map/pois?q=${encodeURIComponent(q.trim())}`
    : "/api/v1/map/pois";
  const res = await apiFetch(path);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not load POIs"));
  return data;
}

export async function fetchRecommendedRoute() {
  const res = await apiFetch("/api/v1/map/recommended-route");
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not load route"));
  return data;
}

export async function searchMapPlaces(q) {
  const path = `/api/v1/map/places?q=${encodeURIComponent(q.trim())}`;
  const res = await apiFetch(path);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Search failed"));
  return data;
}

export async function fetchReverseGeocode(latitude, longitude) {
  const qs = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
  }).toString();
  const res = await apiFetch(`/api/v1/map/reverse-geocode?${qs}`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not resolve location"));
  return data;
}

export async function fetchNearbyBuses(latitude, longitude, radiusMeters = 8000) {
  const qs = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    radius: String(radiusMeters),
  }).toString();
  const res = await apiFetch(`/api/v1/tracking/nearby-buses?${qs}`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not load nearby buses"));
  return data;
}

function jsonHeaders() {
  return { "Content-Type": "application/json" };
}

export async function listRouteSummaries() {
  const res = await apiFetch("/api/v1/routes");
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not load routes"));
  return data;
}

export async function fetchRouteStops(routeId) {
  const res = await apiFetch(`/api/v1/map/routes/${encodeURIComponent(routeId)}/stops`);
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not load stops"));
  return data;
}

export async function fetchRouteOptimize(routeId, params = {}) {
  const qs = new URLSearchParams();
  if (params.fromStopId) qs.set("fromStopId", params.fromStopId);
  if (params.toStopId) qs.set("toStopId", params.toStopId);
  if (params.fromLat != null) qs.set("fromLat", String(params.fromLat));
  if (params.fromLng != null) qs.set("fromLng", String(params.fromLng));
  if (params.toLat != null) qs.set("toLat", String(params.toLat));
  if (params.toLng != null) qs.set("toLng", String(params.toLng));
  const q = qs.toString();
  const res = await apiFetch(
    `/api/v1/tracking/routes/${encodeURIComponent(routeId)}/optimize${q ? `?${q}` : ""}`,
  );
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not optimize route"));
  return data;
}

export async function fetchStopEtas(routeId) {
  const res = await apiFetch(
    `/api/v1/tracking/routes/${encodeURIComponent(routeId)}/stop-etas`,
  );
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not load stop ETAs"));
  return data;
}

/** Fare, scheduled buses, live availability, and stop ETAs for passengers. */
export async function fetchRoutePassengerInfo(routeId) {
  const res = await apiFetch(
    `/api/v1/tracking/routes/${encodeURIComponent(routeId)}/passenger-info`,
  );
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not load route info"));
  return data;
}

export async function fetchOsmRoute(waypoints) {
  const res = await apiFetch("/api/v1/tracking/osm-route", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ waypoints }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "OSM routing failed"));
  return data;
}

// ——— Auth (passenger signup/login for feedback only) ———

export async function registerUser(body) {
  const res = await apiFetch("/api/v1/auth/register", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Sign up failed"));
  return data;
}

export async function loginUser(body) {
  const res = await apiFetch("/api/v1/auth/login", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Login failed"));
  return data;
}

export async function requestForgotPassword(email) {
  const res = await apiFetch("/api/v1/auth/forgot-password", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Request failed"));
  return data;
}

export async function resetPasswordWithToken(token, password) {
  const res = await apiFetch("/api/v1/auth/reset-password", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ token, password }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Reset failed"));
  return data;
}

export async function fetchAuthMe() {
  const res = await apiFetch("/api/v1/auth/me");
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not load profile"));
  return data;
}

export async function googleSignInWithIdToken(idToken) {
  const res = await apiFetch("/api/v1/auth/google", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ idToken }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Google sign-in failed"));
  return data;
}

// ——— Passenger feedback ———

export async function submitFeedback(body) {
  const res = await apiFetch("/api/v1/feedback", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not submit feedback"));
  return data;
}

export async function fetchMyFeedback() {
  const res = await apiFetch("/api/v1/feedback/mine");
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not load feedback"));
  return data;
}

// ——— Driver portal ———

export async function fetchDriverAssignment() {
  const res = await apiFetch("/api/v1/auth/driver/assignment");
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not load bus assignment"));
  return data;
}

export async function updateUserProfile(body) {
  const res = await apiFetch("/api/v1/auth/me", {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not update profile"));
  return data;
}

export async function uploadUserAvatar({ imageBase64, mimeType }) {
  const res = await apiFetch("/api/v1/auth/me/avatar", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ imageBase64, mimeType }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(errMessage(data, "Could not upload photo"));
  return data;
}
