import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocale } from "../context/LocaleContext.js";
import { useRoutePreferences } from "../context/RoutePreferencesContext.js";
import { listRouteSummaries, searchLocations, searchMapPlaces } from "../api/gizegoApi.js";
import { filterRoutesByQuery } from "../utils/routeDisplay.js";
import { colors } from "../theme/colors.js";

const SUGGEST_DEBOUNCE_MS = 280;

function PinIcon({ filled }) {
  return (
    <View style={[styles.pinOuter, filled && styles.pinOuterFilled]}>
      <View style={[styles.pinDot, filled && styles.pinDotFilled]} />
    </View>
  );
}

/**
 * Route search: departure (current location OR typed) + destination, with autocomplete.
 */
export function JourneySearchSheet({
  visible,
  onClose,
  onSearch,
  onSelectRoute,
  currentPlace,
  initialDeparture = "",
  initialArrival = "",
  initialFromCurrent = true,
}) {
  const { t } = useLocale();
  const { recentTrips, favoriteRoutes, refresh, toggleFavorite, isFavorite } = useRoutePreferences();
  const toInputRef = useRef(null);
  const fromInputRef = useRef(null);

  const [fromUseCurrent, setFromUseCurrent] = useState(true);
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  /** Which field drives the suggestion list */
  const [focusedField, setFocusedField] = useState("to");
  const [suggestions, setSuggestions] = useState([]);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [catalogRoutes, setCatalogRoutes] = useState([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentLocationLabel =
    currentPlace?.placeName?.trim() || t("journey.currentLocation");

  const refreshPlaceRef = useRef(currentPlace?.refresh);
  refreshPlaceRef.current = currentPlace?.refresh;

  useEffect(() => {
    if (!visible) return;
    const hasCustomFrom = Boolean(initialDeparture?.trim());
    setFromUseCurrent(initialFromCurrent && !hasCustomFrom);
    setFromText(hasCustomFrom ? initialDeparture.trim() : "");
    setToText(initialArrival?.trim() ?? "");
    setFocusedField(hasCustomFrom ? "from" : "to");
    setSuggestions([]);
    setLocationSuggestions([]);
  }, [visible, initialDeparture, initialArrival, initialFromCurrent]);

  useEffect(() => {
    if (!visible) return;
    void refresh();
    void refreshPlaceRef.current?.();
    const tmr = setTimeout(() => toInputRef.current?.focus(), 400);
    return () => clearTimeout(tmr);
  }, [visible, refresh]);

  useEffect(() => {
    if (!visible) return;
    void listRouteSummaries()
      .then((data) => setCatalogRoutes(data.routes ?? []))
      .catch(() => setCatalogRoutes([]));
  }, [visible]);

  const suggestQuery =
    focusedField === "to" ? toText : fromUseCurrent ? "" : fromText;

  const routeMatches = useMemo(() => {
    if (suggestQuery.trim().length < 1) return [];
    return filterRoutesByQuery(catalogRoutes, suggestQuery).slice(0, 6);
  }, [catalogRoutes, suggestQuery]);

  const fetchSuggestions = useCallback(async (q) => {
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      setSuggestions([]);
      setLocationSuggestions([]);
      return;
    }
    setLoadingSuggest(true);
    try {
      const [canonical, places] = await Promise.all([
        searchLocations(trimmed).catch(() => ({ locations: [] })),
        searchMapPlaces(trimmed).catch(() => ({ suggestions: [] })),
      ]);
      const locations = Array.isArray(canonical.locations) ? canonical.locations : [];
      const canonicalNames = new Set(locations.map((l) => l.canonicalName).filter(Boolean));
      const list = [
        ...canonicalNames,
        ...(Array.isArray(places.suggestions)
          ? places.suggestions.filter((name) => !canonicalNames.has(name))
          : []),
      ];
      setLocationSuggestions(locations);
      setSuggestions(Array.isArray(list) ? list : []);
    } catch {
      setLocationSuggestions([]);
      setSuggestions([]);
    } finally {
      setLoadingSuggest(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const tmr = setTimeout(() => void fetchSuggestions(suggestQuery), SUGGEST_DEBOUNCE_MS);
    return () => clearTimeout(tmr);
  }, [visible, suggestQuery, fetchSuggestions]);

  const pickCurrentLocation = () => {
    setFromUseCurrent(true);
    setFromText("");
    setFocusedField("to");
    setSuggestions([]);
    setLocationSuggestions([]);
    if (!currentPlace?.placeName && !currentPlace?.loading) {
      void refreshPlaceRef.current?.();
    }
    setTimeout(() => toInputRef.current?.focus(), 120);
  };

  const pickTypeDeparture = () => {
    setFromUseCurrent(false);
    setFocusedField("from");
    setSuggestions([]);
    setLocationSuggestions([]);
    setTimeout(() => fromInputRef.current?.focus(), 120);
  };

  const applySuggestionToField = (name, field) => {
    if (field === "from") {
      setFromUseCurrent(false);
      setFromText(name);
      setFocusedField("to");
      setSuggestions([]);
      setLocationSuggestions([]);
      setTimeout(() => toInputRef.current?.focus(), 120);
      return;
    }
    setToText(name);
    setSuggestions([]);
    setLocationSuggestions([]);
  };

  const pickRoute = (route) => {
    if (onSelectRoute) {
      onSelectRoute(route);
      onClose();
      return;
    }
    const parts = route.name?.split(" -> ") ?? [];
    if (focusedField === "from") {
      applySuggestionToField(parts[0]?.trim() || route.name, "from");
      return;
    }
    const dest = parts[1]?.trim() || route.name;
    setToText(dest);
    void submitSearch(dest);
  };

  const pickSuggestion = (name) => {
    if (focusedField === "from") {
      applySuggestionToField(name, "from");
      return;
    }
    setToText(name);
    void submitSearch(name);
  };

  const pickLocationSuggestion = (location) => {
    pickSuggestion(location.canonicalName);
  };

  const canSearch =
    toText.trim().length > 0 && (fromUseCurrent || fromText.trim().length > 0);

  const submitSearch = async (arrivalOverride, recentTrip) => {
    const arrival = (arrivalOverride ?? toText).trim();
    if (!arrival) {
      setFocusedField("to");
      toInputRef.current?.focus();
      return;
    }

    const useCurrent = recentTrip?.fromUseCurrent ?? fromUseCurrent;
    const depText = recentTrip && !recentTrip.fromUseCurrent ? recentTrip.fromLabel : fromText;

    if (!useCurrent && !depText.trim()) {
      setFocusedField("from");
      fromInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      await onSearch({
        departure: useCurrent ? "" : depText.trim(),
        arrival,
        fromUseCurrent: useCurrent,
        fromLat: recentTrip?.fromLat ?? (useCurrent ? currentPlace?.coords?.latitude : undefined),
        fromLng: recentTrip?.fromLng ?? (useCurrent ? currentPlace?.coords?.longitude : undefined),
        fromLabel: useCurrent
          ? recentTrip?.fromLabel || currentLocationLabel
          : depText.trim(),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const pickRecentTrip = (trip) => {
    if (trip.fromUseCurrent) {
      setFromUseCurrent(true);
      setFromText("");
    } else {
      setFromUseCurrent(false);
      setFromText(trip.fromLabel ?? "");
    }
    setToText(trip.toLabel ?? "");
    void submitSearch(trip.toLabel, trip);
  };

  const pickFavoriteRoute = (fav) => {
    if (onSelectRoute) {
      onSelectRoute({
        id: fav.routeId,
        name: fav.name,
        code: fav.code,
        price: fav.price,
        distanceMeters: fav.distanceMeters,
      });
      onClose();
      return;
    }
    const parts = fav.name?.split(" -> ") ?? [];
    if (parts[1]?.trim()) {
      setToText(parts[1].trim());
      void submitSearch(parts[1].trim());
    }
  };

  const onFavoriteStarPress = (route, e) => {
    e?.stopPropagation?.();
    void toggleFavorite({
      id: route.id ?? route.routeId,
      name: route.name,
      code: route.code,
      price: route.price,
      distanceMeters: route.distanceMeters,
    });
  };

  const showRecentAndFavorites = suggestQuery.trim().length < 1;

  const gpsPlaceDisplay =
    currentPlace?.loading && !currentPlace?.placeName?.trim()
      ? t("journey.locating")
      : currentPlace?.placeName?.trim() || t("journey.currentLocationFallback");

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t("journey.title")}</Text>
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
              <Text style={styles.closeBtnTxt}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetScroll}
          >
            <Text style={styles.sectionLabel}>{t("journey.departureSection")}</Text>

            <Pressable
              style={[styles.optionRow, fromUseCurrent && styles.optionRowActive]}
              onPress={pickCurrentLocation}
            >
              <PinIcon filled={fromUseCurrent} />
              <View style={styles.optionRowText}>
                <Text style={styles.optionKind}>{t("journey.currentLocation")}</Text>
                <Text style={styles.optionValue} numberOfLines={2}>
                  {gpsPlaceDisplay}
                </Text>
              </View>
              {currentPlace?.loading ? (
                <ActivityIndicator size="small" color={colors.accentBlue} />
              ) : fromUseCurrent ? (
                <Text style={styles.checkMark}>✓</Text>
              ) : null}
            </Pressable>

            <Pressable
              style={[styles.optionRow, !fromUseCurrent && styles.optionRowActive]}
              onPress={pickTypeDeparture}
            >
              <View style={styles.typeIconWrap}>
                <Text style={styles.typeIconTxt}>✎</Text>
              </View>
              <View style={styles.optionRowText}>
                <Text style={styles.optionKind}>{t("journey.typeDeparture")}</Text>
                <Text style={styles.optionHint}>{t("journey.typeDepartureHint")}</Text>
              </View>
              {!fromUseCurrent ? <Text style={styles.checkMark}>✓</Text> : null}
            </Pressable>

            {!fromUseCurrent ? (
              <View
                style={[
                  styles.fieldWrap,
                  focusedField === "from" && styles.fieldWrapFocused,
                ]}
              >
                <Text style={styles.inputLabel}>{t("journey.departureLabel")}</Text>
                <TextInput
                  ref={fromInputRef}
                  style={styles.input}
                  value={fromText}
                  onChangeText={(v) => {
                    setFromText(v);
                    setFromUseCurrent(false);
                  }}
                  onFocus={() => setFocusedField("from")}
                  placeholder={t("journey.whereFromPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                  autoCapitalize="sentences"
                  returnKeyType="next"
                  onSubmitEditing={() => {
                    setFocusedField("to");
                    toInputRef.current?.focus();
                  }}
                />
              </View>
            ) : null}

            <Text style={[styles.sectionLabel, styles.sectionLabelArrival]}>
              {t("journey.arrivalSection")}
            </Text>

            <View
              style={[
                styles.fieldWrap,
                focusedField === "to" && styles.fieldWrapFocused,
              ]}
            >
              <Text style={styles.inputLabel}>{t("journey.destinationLabel")}</Text>
              <TextInput
                ref={toInputRef}
                style={styles.input}
                value={toText}
                onChangeText={setToText}
                onFocus={() => setFocusedField("to")}
                placeholder={t("journey.whereToPlaceholder")}
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                autoCapitalize="sentences"
                returnKeyType="search"
                onSubmitEditing={() => {
                  if (canSearch) void submitSearch();
                }}
              />
            </View>

            {showRecentAndFavorites ? (
              <View style={styles.savedBlock}>
                <Text style={styles.savedHeading}>{t("journey.recentTrips")}</Text>
                <Text style={styles.savedHint}>{t("journey.recentTripsHint")}</Text>
                {recentTrips.length === 0 ? (
                  <Text style={styles.savedEmpty}>{t("journey.noRecentTrips")}</Text>
                ) : (
                  recentTrips.map((trip) => (
                    <Pressable
                      key={trip.id}
                      style={({ pressed }) => [styles.savedRow, pressed && styles.suggestRowPressed]}
                      onPress={() => pickRecentTrip(trip)}
                    >
                      <Text style={styles.savedIcon}>🕐</Text>
                      <View style={styles.suggestTextWrap}>
                        <Text style={styles.suggestText} numberOfLines={2}>
                          {trip.fromUseCurrent
                            ? t("journey.currentLocation")
                            : trip.fromLabel || "—"}{" "}
                          → {trip.toLabel}
                        </Text>
                        {trip.routeName ? (
                          <Text style={styles.suggestSubText} numberOfLines={1}>
                            {trip.routeName}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ))
                )}

                <Text style={[styles.savedHeading, styles.savedHeadingFav]}>
                  {t("journey.favoriteRoutes")}
                </Text>
                <Text style={styles.savedHint}>{t("journey.favoriteRoutesHint")}</Text>
                {favoriteRoutes.length === 0 ? (
                  <Text style={styles.savedEmpty}>{t("journey.noFavorites")}</Text>
                ) : (
                  favoriteRoutes.map((fav) => (
                    <Pressable
                      key={fav.routeId}
                      style={({ pressed }) => [styles.savedRow, pressed && styles.suggestRowPressed]}
                      onPress={() => pickFavoriteRoute(fav)}
                    >
                      <View style={styles.routeBadge}>
                        <Text style={styles.routeBadgeTxt}>{t("journey.routeSuggestion")}</Text>
                      </View>
                      <View style={styles.suggestTextWrap}>
                        <Text style={styles.suggestText} numberOfLines={2}>
                          {fav.code ? `${fav.code} · ` : ""}
                          {fav.name}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.starBtn}
                        hitSlop={10}
                        onPress={(e) =>
                          onFavoriteStarPress(
                            {
                              routeId: fav.routeId,
                              id: fav.routeId,
                              name: fav.name,
                              code: fav.code,
                            },
                            e,
                          )
                        }
                      >
                        <Text style={styles.starActive}>♥</Text>
                      </Pressable>
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}

            {suggestQuery.trim().length >= 1 ? (
              <View style={styles.suggestBlock}>
                <Text style={styles.suggestHeading}>
                  {focusedField === "from"
                    ? t("journey.suggestionsForDeparture")
                    : t("journey.suggestionsForDestination")}
                </Text>
                {loadingSuggest ? (
                  <ActivityIndicator style={styles.suggestLoader} color={colors.accentBlue} />
                ) : null}
                {locationSuggestions.map((location) => (
                  <Pressable
                    key={location.id}
                    style={({ pressed }) => [
                      styles.suggestRow,
                      styles.locationSuggestRow,
                      pressed && styles.suggestRowPressed,
                    ]}
                    onPress={() => pickLocationSuggestion(location)}
                  >
                    <PinIcon filled={false} />
                    <View style={styles.suggestTextWrap}>
                      <Text style={styles.suggestText} numberOfLines={1}>
                        {location.canonicalName}
                      </Text>
                      {location.matchedAlias &&
                      location.matchedAlias !== location.canonicalName ? (
                        <Text style={styles.suggestSubText} numberOfLines={1}>
                          {t("journey.aliasMatched", { alias: location.matchedAlias })}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
                {routeMatches.map((route) => (
                  <Pressable
                    key={route.id}
                    style={({ pressed }) => [styles.suggestRow, pressed && styles.suggestRowPressed]}
                    onPress={() => pickRoute(route)}
                  >
                    <View style={styles.routeBadge}>
                      <Text style={styles.routeBadgeTxt}>{t("journey.routeSuggestion")}</Text>
                    </View>
                    <View style={styles.suggestTextWrap}>
                      <Text style={styles.suggestText} numberOfLines={2}>
                        {route.code ? `${route.code} · ` : ""}
                        {route.name}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.starBtn}
                      hitSlop={10}
                      onPress={(e) => onFavoriteStarPress(route, e)}
                    >
                      <Text style={isFavorite(route.id) ? styles.starActive : styles.starIdle}>
                        {isFavorite(route.id) ? "♥" : "♡"}
                      </Text>
                    </Pressable>
                  </Pressable>
                ))}
                {suggestions.slice(0, 10).map((name, i) => (
                  <Pressable
                    key={`${name}-${i}`}
                    style={({ pressed }) => [styles.suggestRow, pressed && styles.suggestRowPressed]}
                    onPress={() => pickSuggestion(name)}
                  >
                    <PinIcon filled={false} />
                    <Text style={styles.suggestText} numberOfLines={2}>
                      {name}
                    </Text>
                  </Pressable>
                ))}
                {!loadingSuggest &&
                locationSuggestions.length === 0 &&
                routeMatches.length === 0 &&
                suggestions.length === 0 ? (
                  <View style={styles.noRouteMatchBox}>
                    <Text style={styles.noRouteMatchTitle}>{t("journey.noRouteMatch")}</Text>
                    <Text style={styles.noRouteMatchSub}>{t("journey.tryPlacesOrRoutesBelow")}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Pressable
              style={[styles.goBtn, !canSearch && styles.goBtnDisabled]}
              onPress={() => void submitSearch()}
              disabled={submitting || !canSearch}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.goBtnTxt}>{t("journey.search")}</Text>
              )}
            </Pressable>

            {fromUseCurrent && currentPlace?.placeName?.trim() ? (
              <Text style={styles.fromHint} numberOfLines={2}>
                {t("journey.fromHint", { from: currentLocationLabel })}
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "88%",
    minHeight: 380,
    paddingBottom: Platform.OS === "ios" ? 12 : 8,
  },
  sheetScroll: {
    paddingBottom: Platform.OS === "ios" ? 20 : 12,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textDark,
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnTxt: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  sectionLabelArrival: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionRowActive: {
    backgroundColor: "#f4f9fc",
  },
  optionRowText: {
    flex: 1,
    marginLeft: 14,
  },
  optionKind: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  optionValue: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textDark,
    lineHeight: 22,
  },
  optionHint: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: "500",
  },
  typeIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textDark,
    alignItems: "center",
    justifyContent: "center",
  },
  typeIconTxt: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textDark,
  },
  checkMark: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.accentBlue,
  },
  pinOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textDark,
    alignItems: "center",
    justifyContent: "center",
  },
  pinOuterFilled: {
    borderColor: colors.accentBlue,
    backgroundColor: "rgba(61,126,166,0.12)",
  },
  pinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textDark,
  },
  pinDotFilled: {
    backgroundColor: colors.accentBlue,
  },
  fieldWrap: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: "#d0d0d0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#fafafa",
  },
  fieldWrapFocused: {
    borderColor: colors.accentBlue,
    backgroundColor: "#f8fbff",
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  input: {
    fontSize: 17,
    color: colors.textDark,
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
    minHeight: 40,
  },
  suggestBlock: {
    marginTop: 8,
    marginHorizontal: 8,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  suggestHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  suggestLoader: {
    marginVertical: 12,
  },
  noRouteMatchBox: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#fff8e1",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ffe082",
  },
  noRouteMatchTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#e65100",
    marginBottom: 4,
  },
  noRouteMatchSub: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  suggestRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  suggestRowPressed: {
    backgroundColor: "#eef6fc",
  },
  locationSuggestRow: {
    backgroundColor: "#f8fbff",
  },
  suggestText: {
    flex: 1,
    fontSize: 16,
    color: colors.textDark,
  },
  suggestSubText: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textMuted,
  },
  suggestTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  routeBadge: {
    backgroundColor: "#e8f4fc",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  routeBadgeTxt: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.accentBlue,
    textTransform: "uppercase",
  },
  goBtn: {
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: colors.accentBlue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  goBtnDisabled: {
    opacity: 0.45,
  },
  goBtnTxt: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 16,
  },
  fromHint: {
    textAlign: "center",
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 10,
    paddingHorizontal: 20,
  },
  savedBlock: {
    marginTop: 4,
    marginHorizontal: 8,
    marginBottom: 4,
  },
  savedHeading: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textDark,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  savedHeadingFav: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  savedHint: {
    fontSize: 11,
    color: colors.textMuted,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  savedEmpty: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  savedIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  starBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  starActive: {
    fontSize: 20,
    color: "#e53935",
  },
  starIdle: {
    fontSize: 20,
    color: "#bdbdbd",
  },
});
