import { Platform } from "react-native";

/**
 * Create OAuth clients in Google Cloud Console and set these in `apps/mobile/.env`.
 * The API must list the same client IDs in GOOGLE_OAUTH_CLIENT_IDS (comma-separated).
 */
export function getGoogleAuthConfig() {
  return {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
  };
}

/**
 * expo-auth-session requires a non-undefined platform client id at hook init; real sign-in still needs env values.
 */
export const PLACEHOLDER_GOOGLE_CLIENT_ID = "000000000000-not-configured.apps.googleusercontent.com";

export function isGoogleSignInConfigured() {
  const c = getGoogleAuthConfig();
  if (!c.webClientId.trim()) return false;
  if (Platform.OS === "android") return Boolean(c.androidClientId.trim());
  if (Platform.OS === "ios") return Boolean(c.iosClientId.trim());
  return true;
}
