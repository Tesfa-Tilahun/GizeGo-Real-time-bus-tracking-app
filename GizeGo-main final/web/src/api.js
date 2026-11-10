const TOKEN_KEY = "gizego_web_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.message ?? data?.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export async function login(identifier, password) {
  return request("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
}

export async function forgotPassword(email) {
  return request("/api/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token, password) {
  return request("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function fetchDriverAssignment() {
  return request("/api/v1/auth/driver/assignment");
}

export async function fetchMe() {
  return request("/api/v1/auth/me");
}

export async function fetchRoutes() {
  return request("/api/v1/routes");
}

export async function fetchRoute(routeId) {
  return request(`/api/v1/routes/${routeId}`);
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
  return request(`/api/v1/tracking/routes/${encodeURIComponent(routeId)}/optimize${q ? `?${q}` : ""}`);
}

export async function createRoute(payload) {
  return request("/api/v1/routes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateRoute(routeId, payload) {
  return request(`/api/v1/routes/${routeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteRoute(routeId) {
  return request(`/api/v1/routes/${routeId}`, { method: "DELETE" });
}

export async function fetchFleet() {
  return request("/api/v1/admin/fleet");
}

export async function fetchDrivers() {
  return request("/api/v1/admin/drivers");
}

export async function assignDriver(busId, driverId) {
  return request(`/api/v1/admin/buses/${busId}/driver`, {
    method: "PATCH",
    body: JSON.stringify({ driverId }),
  });
}

export async function createDriver(payload) {
  return request("/api/v1/admin/drivers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminDashboard(params = {}) {
  const qs = new URLSearchParams();
  if (params.period) qs.set("period", params.period);
  if (params.routeId) qs.set("routeId", params.routeId);
  if (params.busId) qs.set("busId", params.busId);
  const q = qs.toString();
  return request(`/api/v1/admin/dashboard${q ? `?${q}` : ""}`);
}

export async function fetchOperationsReport(params = {}) {
  const qs = new URLSearchParams();
  if (params.period) qs.set("period", params.period);
  if (params.routeId) qs.set("routeId", params.routeId);
  if (params.busId) qs.set("busId", params.busId);
  const q = qs.toString();
  return request(`/api/v1/admin/reports/operations${q ? `?${q}` : ""}`);
}

export async function fetchBuses() {
  return request("/api/v1/buses");
}

export async function createBus(payload) {
  return request("/api/v1/buses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBus(busId, payload) {
  return request(`/api/v1/buses/${busId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteBus(busId) {
  return request(`/api/v1/buses/${busId}`, { method: "DELETE" });
}

export async function fetchBus(busId) {
  return request(`/api/v1/buses/${busId}`);
}

export async function assignBusToRoute(routeId, payload) {
  return request(`/api/v1/routes/${routeId}/buses`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBusRouteAssignment(routeId, busId, payload) {
  return request(`/api/v1/routes/${routeId}/buses/${busId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function unassignBusFromRoute(routeId, busId) {
  return request(`/api/v1/routes/${routeId}/buses/${busId}`, { method: "DELETE" });
}

export async function fetchOperators() {
  return request("/api/v1/admin/operators");
}

export async function createOperator(payload) {
  return request("/api/v1/admin/operators", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateOperator(operatorId, payload) {
  return request(`/api/v1/admin/operators/${operatorId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteOperator(operatorId) {
  return request(`/api/v1/admin/operators/${operatorId}`, { method: "DELETE" });
}

export async function fetchAdminFeedback(params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.routeId) qs.set("routeId", params.routeId);
  const q = qs.toString();
  return request(`/api/v1/admin/feedback${q ? `?${q}` : ""}`);
}

export async function reviewFeedback(feedbackId, payload) {
  return request(`/api/v1/admin/feedback/${feedbackId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
