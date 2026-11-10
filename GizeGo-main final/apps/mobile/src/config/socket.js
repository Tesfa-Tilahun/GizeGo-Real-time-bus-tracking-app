import { API_BASE_URL } from "./api.js";

/** Socket.IO server URL (same host as REST API). */
export const SOCKET_URL = API_BASE_URL.replace(/\/$/, "");
