import { useEffect, useCallback, useState, useRef } from "react";
import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import {
  getGoogleAuthConfig,
  isGoogleSignInConfigured,
  PLACEHOLDER_GOOGLE_CLIENT_ID,
} from "../config/google.js";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_REDIRECT_PATH = "oauthredirect";

/** Scopes merged with expo-auth-session Google minimumScopes; full URLs avoid mapping edge cases */
const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
];

/**
 * Opens Google OAuth and exposes `idToken` when ready to send to your API.
 * Second argument to useAuthSession: stable redirect for Expo Go (scheme from app.json);
 * standalone/bare builds still use `{package}:/{path}` via the provider defaults.
 */
export function useGoogleSignIn() {
  const cfg = getGoogleAuthConfig();
  const configured = isGoogleSignInConfigured();
  const scheme = Constants.expoConfig?.scheme ?? "gizego";

  const [request, response, promptAsync] = Google.useAuthRequest(
    {
      webClientId: cfg.webClientId.trim() || PLACEHOLDER_GOOGLE_CLIENT_ID,
      iosClientId: cfg.iosClientId.trim() || PLACEHOLDER_GOOGLE_CLIENT_ID,
      androidClientId: cfg.androidClientId.trim() || PLACEHOLDER_GOOGLE_CLIENT_ID,
      scopes: GOOGLE_SCOPES,
      selectAccount: true,
    },
    { scheme, path: GOOGLE_REDIRECT_PATH },
  );

  const [idToken, setIdToken] = useState(null);
  const handledRef = useRef(null);

  useEffect(() => {
    if (response?.type === "error" || response?.type === "cancel" || response?.type === "dismiss") {
      handledRef.current = null;
      setIdToken(null);
      return;
    }
    if (response?.type !== "success") return;
    // Native flow: success + code first, then code exchange fills id_token (handled by expo-auth-session).
    if (
      response.params?.code &&
      !response.authentication?.idToken &&
      !response.params?.id_token &&
      !response.params?.idToken
    ) {
      return;
    }
    const t =
      response.authentication?.idToken ??
      response.params?.id_token ??
      response.params?.idToken;
    if (!t) {
      setIdToken(null);
      return;
    }
    if (handledRef.current === t) return;
    handledRef.current = t;
    setIdToken(t);
  }, [response]);

  const prompt = useCallback(async () => {
    if (!configured) {
      return { type: "error", error: "not_configured" };
    }
    setIdToken(null);
    handledRef.current = null;
    return promptAsync();
  }, [configured, promptAsync]);

  const clearIdToken = useCallback(() => {
    setIdToken(null);
    handledRef.current = null;
  }, []);

  return { request, response, idToken, prompt, clearIdToken, configured };
}
