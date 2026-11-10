import { Platform } from "react-native";
import Constants from "expo-constants";

const DEFAULT_PORT = parseInt(process.env.EXPO_PUBLIC_API_PORT || "3000", 10) || 3000;

/**
 * Dev machine IP when using Expo Go (e.g. "192.168.1.5:8081" → "192.168.1.5").
 * Override anytime: EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000
 */
function hostFromExpo() {
  const dbg = Constants.expoGoConfig?.debuggerHost;
  if (dbg && typeof dbg === "string") {
    return dbg.split(":")[0] || null;
  }
  const uri = Constants.expoConfig?.hostUri;
  if (uri && typeof uri === "string") {
    return uri.split(":")[0] || null;
  }
  return null;
}

function buildDefaultBaseUrl() {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "");
  if (explicit) {
    return explicit;
  }
  const host =
    hostFromExpo() ?? (Platform.OS === "android" ? "10.0.2.2" : "localhost");
  return `http://${host}:${DEFAULT_PORT}`;
}

export const API_BASE_URL = buildDefaultBaseUrl();
