import { AppError } from "../shared/errors/AppError.js";

/**
 * Google Cloud Translation API (v2). Enable in Google Cloud Console and create an API key
 * with "Cloud Translation API" enabled. No auth user required for mobile if you call only this public route.
 *
 * @param {{ texts: string[]; source?: string; target: string; apiKey: string }} p
 * @returns {Promise<string[]>}
 */
export async function googleCloudTranslateTexts({ texts, source, target, apiKey }) {
  if (!apiKey?.trim()) {
    throw new AppError(
      "Translation is not configured (set GOOGLE_CLOUD_TRANSLATIONS_API_KEY on the API server)",
      503,
    );
  }
  if (!texts.length) {
    return [];
  }

  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey.trim())}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: texts,
      target,
      ...(source ? { source } : {}),
      format: "text",
    }),
  });

  const raw = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      raw?.error?.message ||
      (typeof raw === "object" && JSON.stringify(raw)) ||
      `HTTP ${res.status}`;
    console.error("[gizego] Cloud Translation error:", msg);
    throw new AppError("Translation service error", 502);
  }

  const list = raw?.data?.translations;
  if (!Array.isArray(list)) {
    throw new AppError("Unexpected translation response", 502);
  }
  return list.map((row) => row?.translatedText ?? "");
}
