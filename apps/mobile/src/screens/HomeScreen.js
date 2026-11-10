import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import { AppHeader } from "../components/AppHeader.js";
import { JourneySearchSheet } from "../components/JourneySearchSheet.js";
import { SideMenu } from "../components/SideMenu.js";
import { colors } from "../theme/colors.js";
import { useLocale } from "../context/LocaleContext.js";
import { useRoutePreferences } from "../context/RoutePreferencesContext.js";
import {
  fetchRoutePassengerInfo,
  searchRoutes,
} from "../api/gizegoApi.js";
import { useCurrentPlace } from "../hooks/useCurrentPlace.js";
import { estimateMinutesFromDistanceMeters, formatKmOneDecimal } from "../utils/travelMetrics.js";
import { resolveTripEndpoints } from "../utils/tripSearch.js";

const BUS_IMAGE =
  "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1080&q=80";

export function HomeScreen({ navigation }) {
  const { t } = useLocale();
  const { recordRecentTrip, recentTrips, favoriteRoutes, refresh, toggleFavorite } =
    useRoutePreferences();
  const [menuOpen, setMenuOpen] = useState(false);

  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [fromUseCurrent, setFromUseCurrent] = useState(true);
  const [journeyOpen, setJourneyOpen] = useState(false);
  const currentPlace = useCurrentPlace(true);

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchedTrip, setSearchedTrip] = useState(null);
  const [searchProblem, setSearchProblem] = useState("");
  /** routeId → passenger info (buses, fare, live ETAs) */
  const [routeInfoById, setRouteInfoById] = useState({});

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (searchResults.length === 0) {
      setRouteInfoById({});
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        searchResults.slice(0, 10).map(async (r) => {
          try {
            const info = await fetchRoutePassengerInfo(r.id);
            return [r.id, info];
          } catch {
            return [r.id, null];
          }
        }),
      );
      if (!cancelled) {
        setRouteInfoById(Object.fromEntries(pairs));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchResults]);

  const noDirectMatch = Boolean(searchedTrip && !searchLoading && searchResults.length === 0);

  const openRouteOnMap = (routeId) => {
    Keyboard.dismiss();
    navigation.navigate("Map", { routeId });
  };

  const openRecentTrip = (trip) => {
    Keyboard.dismiss();
    const fromLabel = String(trip.fromLabel ?? "").trim();
    const currentLabels = new Set([
      t("journey.currentLocation").toLowerCase(),
      t("home.currentLocation").toLowerCase(),
      "current location",
      "my current location",
    ]);
    const useCurrent = Boolean(trip.fromUseCurrent) || currentLabels.has(fromLabel.toLowerCase());
    navigation.navigate({
      name: "Map",
      params: {
        routeId: undefined,
        departure: useCurrent ? "" : fromLabel,
        arrival: trip.toLabel,
        fromUseCurrent: useCurrent,
        fromLat: useCurrent ? trip.fromLat ?? undefined : undefined,
        fromLng: useCurrent ? trip.fromLng ?? undefined : undefined,
        openJourneySearch: undefined,
      },
      merge: false,
    });
  };

  const onFavoriteStarPress = (route, e) => {
    e?.stopPropagation?.();
    void toggleFavorite({
      id: route.routeId ?? route.id,
      name: route.name,
      code: route.code,
      price: route.price,
      distanceMeters: route.distanceMeters,
    });
  };

  const openTripOnMap = async () => {
    const resolved = await resolveTripEndpoints({
      departure: fromUseCurrent ? "" : departure,
      arrival,
      coords: fromUseCurrent ? currentPlace.coords : null,
      placeName: fromUseCurrent ? currentPlace.placeName : "",
    });
    if (resolved.error) return;
    const { from: d, to: a, fromLat, fromLng } = resolved;
    navigation.navigate("Map", {
      departure: fromUseCurrent ? "" : d,
      arrival: a,
      fromUseCurrent,
      fromLat,
      fromLng,
      openJourneySearch: true,
    });
  };

  const handleJourneySheetSearch = async ({
    departure: dep,
    arrival: arr,
    fromUseCurrent: useGps,
    fromLat,
    fromLng,
    fromLabel,
  }) => {
    setFromUseCurrent(useGps);
    setDeparture(useGps ? fromLabel : dep);
    setArrival(arr);
    Keyboard.dismiss();

    const resolved = await resolveTripEndpoints({
      departure: useGps ? "" : dep,
      arrival: arr,
      coords: useGps ? currentPlace.coords : null,
      placeName: useGps ? fromLabel : "",
    });
    if (resolved.error === "arrival_required") {
      Alert.alert(t("home.searchTitle"), t("home.searchMissingArrival"));
      return;
    }
    if (resolved.error === "departure_required") {
      Alert.alert(t("home.searchTitle"), t("home.searchMissingDeparture"));
      return;
    }

    setSearchLoading(true);
    setSearchResults([]);
    setSearchedTrip(null);
    setSearchProblem("");
    try {
      const searchFromLat = useGps ? fromLat ?? resolved.fromLat : undefined;
      const searchFromLng = useGps ? fromLng ?? resolved.fromLng : undefined;
      const data = await searchRoutes(resolved.from, resolved.to, {
        fromLat: searchFromLat,
        fromLng: searchFromLng,
      });
      const rows = data.routes ?? [];
      const canonicalFrom = data.searchMeta?.from?.canonicalName;
      const canonicalTo = data.searchMeta?.to?.canonicalName;
      setSearchProblem(data.searchMeta?.message ?? "");
      setSearchResults(rows);
      setSearchedTrip({
        from: canonicalFrom || (useGps ? fromLabel : resolved.from),
        to: canonicalTo || resolved.to,
      });
      void recordRecentTrip({
        fromLabel: canonicalFrom || (useGps ? fromLabel : resolved.from),
        toLabel: canonicalTo || resolved.to,
        fromUseCurrent: useGps,
        fromLat: useGps ? searchFromLat ?? null : null,
        fromLng: useGps ? searchFromLng ?? null : null,
        routeId: rows[0]?.id ?? null,
        routeName: rows[0]?.name ?? null,
      });
    } catch {
      setSearchResults([]);
      setSearchedTrip(null);
      Alert.alert(t("home.searchTitle"), t("home.searchFailed"));
    } finally {
      setSearchLoading(false);
    }
  };

  const departureLabel =
    fromUseCurrent && !departure.trim()
      ? currentPlace.placeName?.trim() || t("journey.currentLocation")
      : departure.trim();

  const tripSummaryLine =
    departureLabel && arrival.trim()
      ? `${departureLabel} → ${arrival}`
      : arrival.trim()
        ? `${currentPlace.placeName?.trim() || t("journey.currentLocation")} → ${arrival}`
        : t("journey.tapToPlan");

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AppHeader onMenuPress={() => setMenuOpen(true)} />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} navigation={navigation} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ImageBackground source={{ uri: BUS_IMAGE }} style={styles.hero} imageStyle={styles.heroImg}>
          <LinearGradient colors={["rgba(90,130,160,0.72)", "rgba(45,85,118,0.88)"]} style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>
              {t("home.hero1")}
              <Text style={styles.heroAccent}>{t("home.heroAccent1")}</Text>
            </Text>
            <Text style={styles.heroTitle}>
              {t("home.hero2")}
              <Text style={styles.heroAccent}>{t("home.heroAccent2")}</Text>
            </Text>
            <Text style={styles.heroSub}>{t("home.heroSub")}</Text>
            <Pressable
              style={styles.heroMapBtn}
              onPress={() => navigation.navigate("Map", { openJourneySearch: true })}
            >
              <Text style={styles.heroMapBtnTxt}>{t("home.openLiveMap")}</Text>
            </Pressable>
          </LinearGradient>
        </ImageBackground>

        <View style={styles.tripBackdrop}>
          <View style={styles.tripCard}>
            <LinearGradient colors={["rgba(61,126,166,0.08)", "rgba(61,126,166,0.02)"]} style={styles.tripCardHeader}>
              <Text style={styles.tripCardTitle}>{t("home.planTrip")}</Text>
              <Text style={styles.tripCardSub}>{t("home.ethiopiaSearchHint")}</Text>
            </LinearGradient>

            <View style={styles.tripCardBody}>
              <Pressable
                style={styles.journeyLauncher}
                onPress={() => setJourneyOpen(true)}
              >
                <Text style={styles.journeyLauncherTitle}>{t("journey.title")}</Text>
                <Text style={styles.journeyLauncherSub} numberOfLines={2}>
                  {tripSummaryLine}
                </Text>
                <Text style={styles.journeyLauncherCta}>{t("home.openJourneySearch")} ›</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {searchLoading ? (
          <View style={styles.resultsLoading}>
            <ActivityIndicator size="small" color={colors.accentBlue} />
            <Text style={styles.resultsLoadingTxt}>{t("home.searching")}</Text>
          </View>
        ) : searchedTrip && searchResults.length > 0 ? (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>{t("home.resultsTitle")}</Text>
            <Text style={styles.resultsSub}>
              {t("home.resultsSub", { from: searchedTrip?.from ?? "", to: searchedTrip?.to ?? "" })}
            </Text>
            <Pressable style={styles.compareBanner} onPress={openTripOnMap}>
              <Text style={styles.compareBannerTxt}>{t("home.openMapComparison")}</Text>
              <Text style={styles.compareBannerSub}>{t("home.compareHint")}</Text>
            </Pressable>
            {searchResults.map((r) => (
              <View key={r.id} style={styles.routeResultCard}>
                <View style={styles.routeAccent} />
                <View style={styles.routeResultInner}>
                  <Text style={styles.routeResultName}>{r.name}</Text>
                  <View style={styles.metricRow}>
                    <View style={styles.metricChip}>
                      <Text style={styles.metricChipLbl}>{t("home.priceBadge")}</Text>
                      <Text style={styles.metricChipVal}>{t("home.etbShort", { price: r.price })}</Text>
                    </View>
                    <View style={[styles.metricChip, styles.metricChipAlt]}>
                      <Text style={styles.metricChipLbl}>{t("home.busesBadge")}</Text>
                      <Text style={styles.metricChipVal}>
                        {t("home.busCountShort", {
                          count: r.busCount != null ? r.busCount : 0,
                        })}
                      </Text>
                    </View>
                    <View style={styles.metricChip}>
                      <Text style={styles.metricChipLbl}>{t("home.stopsBadge")}</Text>
                      <Text style={styles.metricChipVal}>
                        {t("home.stopCountShort", { count: r.stopCount ?? 0 })}
                      </Text>
                    </View>
                  </View>
                  {r.distanceMeters != null ? (
                    <Text style={styles.routeDistanceEta}>
                      {t("home.resultDistanceEta", {
                        km: formatKmOneDecimal(r.distanceMeters),
                        min: estimateMinutesFromDistanceMeters(r.distanceMeters),
                      })}
                    </Text>
                  ) : null}
                  {routeInfoById[r.id] ? (
                    <Text style={styles.busAvailLine}>
                      {routeInfoById[r.id].anyBusAvailableNow
                        ? t("trip.busesAvailableCount", {
                            count: routeInfoById[r.id].liveBusCount,
                          })
                        : routeInfoById[r.id].buses?.[0]?.departureTime
                          ? t("trip.busNextDeparture", {
                              time: routeInfoById[r.id].buses[0].departureTime,
                            })
                          : t("trip.noBusLiveNow")}
                    </Text>
                  ) : (
                    <ActivityIndicator size="small" color={colors.accentBlue} style={styles.busAvailLoader} />
                  )}
                  <Pressable
                    style={styles.viewRouteBtn}
                    onPress={() => openRouteOnMap(r.id)}
                  >
                    <Text style={styles.viewRouteBtnTxt}>{t("home.viewRoute")}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {noDirectMatch ? (
          <View style={[styles.savedSection, styles.noDirectMatchWrap]}>
            <View style={styles.noDirectMatchBanner}>
              <Text style={styles.noDirectMatchTitle}>{t("home.noRoutesTitle")}</Text>
              <Text style={styles.noDirectMatchTrip}>
                {t("home.noDirectMatchForTrip", {
                  from: searchedTrip?.from ?? "",
                  to: searchedTrip?.to ?? "",
                })}
              </Text>
              <Text style={styles.noDirectMatchBody}>{searchProblem || t("home.noRoutesBody")}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.savedSection}>
          <Text style={styles.resultsTitle}>{t("journey.recentTrips")}</Text>
          <Text style={styles.resultsSub}>{t("journey.recentTripsHint")}</Text>
          {recentTrips.length === 0 ? (
            <Text style={styles.savedEmpty}>{t("journey.noRecentTrips")}</Text>
          ) : (
            recentTrips.map((trip) => (
              <Pressable
                key={trip.id}
                style={styles.routeResultCard}
                onPress={() => openRecentTrip(trip)}
              >
                <View style={[styles.routeAccent, styles.routeAccentRecent]} />
                <View style={styles.routeResultInner}>
                  <Text style={styles.routeResultName} numberOfLines={2}>
                    {trip.fromUseCurrent ? t("journey.currentLocation") : trip.fromLabel || "—"} →{" "}
                    {trip.toLabel}
                  </Text>
                  {trip.routeName ? (
                    <Text style={styles.routeDistanceEta} numberOfLines={1}>
                      {trip.routeName}
                    </Text>
                  ) : null}
                  <Text style={styles.savedAction}>{t("home.openRecentTrip")}</Text>
                </View>
              </Pressable>
            ))
          )}

          <Text style={[styles.resultsTitle, styles.savedTitleGap]}>{t("journey.favoriteRoutes")}</Text>
          <Text style={styles.resultsSub}>{t("journey.favoriteRoutesHint")}</Text>
          {favoriteRoutes.length === 0 ? (
            <Text style={styles.savedEmpty}>{t("journey.noFavorites")}</Text>
          ) : (
            favoriteRoutes.map((fav) => (
              <Pressable
                key={fav.routeId}
                style={styles.routeResultCard}
                onPress={() => openRouteOnMap(fav.routeId)}
              >
                <View style={[styles.routeAccent, styles.routeAccentFav]} />
                <View style={styles.routeResultInner}>
                  <View style={styles.favRow}>
                    <View style={styles.favRowMain}>
                      <Text style={styles.routeResultName} numberOfLines={2}>
                        {fav.code ? `${fav.code} · ` : ""}
                        {fav.name}
                      </Text>
                      {fav.distanceMeters != null ? (
                        <Text style={styles.routeDistanceEta}>
                          {t("home.resultDistanceEta", {
                            km: formatKmOneDecimal(fav.distanceMeters),
                            min: estimateMinutesFromDistanceMeters(fav.distanceMeters),
                          })}
                        </Text>
                      ) : null}
                      <Text style={styles.savedAction}>{t("home.viewRoute")}</Text>
                    </View>
                    <Pressable
                      style={styles.starBtn}
                      hitSlop={10}
                      onPress={(e) =>
                        onFavoriteStarPress(
                          {
                            routeId: fav.routeId,
                            name: fav.name,
                            code: fav.code,
                            price: fav.price,
                            distanceMeters: fav.distanceMeters,
                          },
                          e,
                        )
                      }
                    >
                      <Text style={styles.starActive}>♥</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            ))
          )}

          <Pressable style={styles.linkish} onPress={() => navigation.navigate("BrowseRoutes")}>
            <Text style={styles.linkishTxt}>{t("home.browseAllRoutes")}  ›</Text>
          </Pressable>
        </View>
      </ScrollView>

      <JourneySearchSheet
        visible={journeyOpen}
        onClose={() => setJourneyOpen(false)}
        onSearch={handleJourneySheetSearch}
        onSelectRoute={(route) => openRouteOnMap(route.id)}
        currentPlace={currentPlace}
        initialDeparture={fromUseCurrent ? "" : departure}
        initialArrival={arrival}
        initialFromCurrent={fromUseCurrent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#e8eef4",
  },
  scroll: {
    paddingBottom: 100,
  },
  hero: {
    minHeight: 268,
    width: "100%",
  },
  heroImg: {
    resizeMode: "cover",
  },
  heroOverlay: {
    flex: 1,
    padding: 24,
    justifyContent: "flex-end",
    paddingBottom: 36,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 26,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroAccent: {
    color: "#bfe0ff",
  },
  heroSub: {
    color: "rgba(255,255,255,0.96)",
    fontSize: 15,
    marginTop: 10,
    marginBottom: 18,
    lineHeight: 22,
  },
  heroMapBtn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.5)",
  },
  heroMapBtnTxt: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  tripBackdrop: {
    paddingHorizontal: 14,
    marginTop: -28,
    zIndex: 2,
  },
  tripCard: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.white,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  tripCardHeader: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(61,126,166,0.15)",
  },
  tripCardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textDark,
  },
  tripCardSub: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  tripCardBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    backgroundColor: colors.white,
  },
  journeyLauncher: {
    borderWidth: 1.5,
    borderColor: "#c5d9e8",
    borderRadius: 16,
    padding: 18,
    backgroundColor: "#f9fcff",
  },
  journeyLauncherTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textDark,
    marginBottom: 8,
  },
  journeyLauncherSub: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: 10,
  },
  journeyLauncherCta: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.accentBlue,
  },
  fieldWrap: { marginBottom: 4 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textDark,
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: 12,
    color: colors.accentBlue,
    marginBottom: 8,
    fontWeight: "500",
  },
  inputModern: {
    borderWidth: 1.5,
    borderColor: "#c5d9e8",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 15 : 12,
    fontSize: 16,
    backgroundColor: "#f9fcff",
    color: colors.textDark,
  },
  useLocationBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#e8f4fc",
    borderWidth: 1,
    borderColor: "#b8d4e8",
    minHeight: 36,
    justifyContent: "center",
  },
  useLocationBtnTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accentBlue,
  },
  routeArrowWrap: {
    alignItems: "center",
    marginVertical: -4,
    marginLeft: 8,
    height: 36,
    justifyContent: "center",
  },
  routeArrowLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.accentBlue,
    opacity: 0.35,
    minHeight: 8,
  },
  routeArrowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accentHighlight,
    borderWidth: 2,
    borderColor: colors.white,
  },
  routeArrowDotEnd: {
    backgroundColor: "#22c55e",
  },
  rel: {
    position: "relative",
    zIndex: 1,
    marginBottom: 8,
  },
  relOnTop: {
    zIndex: 10,
    marginBottom: 8,
  },
  suggestPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "100%",
    marginTop: 4,
    maxHeight: 200,
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce8f0",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  suggestRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestRowPressed: {
    backgroundColor: "#eef6fc",
  },
  suggestBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentBlue,
    marginRight: 10,
    opacity: 0.85,
  },
  suggestText: {
    flex: 1,
    fontSize: 15,
    color: colors.textDark,
  },
  searchBtnWrap: {
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  searchGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnLabel: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 17,
    letterSpacing: 0.3,
  },
  resultsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 8,
  },
  resultsLoadingTxt: {
    color: colors.textMuted,
    fontSize: 14,
    marginLeft: 10,
  },
  resultsSection: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  suggestedSection: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  savedSection: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  noDirectMatchWrap: {
    marginTop: 12,
    marginBottom: 0,
  },
  savedTitleGap: {
    marginTop: 20,
  },
  savedEmpty: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: "italic",
    marginBottom: 12,
  },
  savedAction: {
    color: colors.accentBlue,
    fontWeight: "600",
    fontSize: 13,
    marginTop: 4,
  },
  favRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  favRowMain: {
    flex: 1,
  },
  starBtn: {
    paddingLeft: 8,
    paddingTop: 2,
  },
  starActive: {
    fontSize: 22,
    color: "#e53935",
  },
  noDirectMatchBanner: {
    backgroundColor: "rgba(61, 126, 166, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(61, 126, 166, 0.2)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  noDirectMatchTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.accentBlue,
    marginBottom: 6,
  },
  noDirectMatchTrip: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textDark,
    marginBottom: 8,
  },
  noDirectMatchBody: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
  },
  operatorRow: {
    gap: 8,
    paddingBottom: 10,
  },
  operatorChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(61, 126, 166, 0.3)",
    backgroundColor: "rgba(61, 126, 166, 0.1)",
    marginRight: 8,
  },
  operatorChipActive: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  operatorChipTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accentBlue,
  },
  operatorChipTxtActive: {
    color: colors.white,
  },
  routeFilterInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
    backgroundColor: colors.white,
    color: colors.textDark,
    marginBottom: 12,
  },
  routesLoader: {
    marginVertical: 16,
  },
  routesErrorTxt: {
    color: "#b91c1c",
    fontSize: 14,
    marginBottom: 8,
  },
  routesEmptyTxt: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 8,
  },
  suggestLink: {
    marginTop: 4,
  },
  resultsTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: colors.textDark,
  },
  resultsSub: {
    marginTop: 6,
    fontSize: 15,
    color: colors.accentBlue,
    fontWeight: "600",
    marginBottom: 14,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textDark,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: 12,
  },
  linkish: {
    alignSelf: "center",
    marginTop: 24,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.accentBlue,
    backgroundColor: colors.white,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accentBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  linkishTxt: {
    color: colors.accentBlue,
    fontWeight: "700",
    fontSize: 16,
  },
  compareBanner: {
    backgroundColor: "#1f4f6f",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  compareBannerTxt: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
  },
  compareBannerSub: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    fontWeight: "500",
  },
  routeResultCard: {
    flexDirection: "row",
    marginBottom: 16,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  routeAccent: {
    width: 5,
    backgroundColor: colors.accentBlue,
  },
  routeAccentRecent: {
    backgroundColor: colors.accentHighlight,
  },
  routeAccentFav: {
    backgroundColor: colors.accentBlue,
  },
  routeResultInner: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  routeResultName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textDark,
    marginBottom: 8,
    lineHeight: 22,
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  metricChip: {
    backgroundColor: "rgba(61, 126, 166, 0.1)",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 11,
    marginRight: 8,
    marginBottom: 8,
    minWidth: 88,
    borderWidth: 1,
    borderColor: "#d4e8f7",
  },
  metricChipAlt: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  metricChipLbl: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  metricChipVal: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textDark,
  },
  routeDistanceEta: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: -0.1,
    marginBottom: 6,
    marginTop: -2,
  },
  busAvailLine: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2e7d32",
    marginBottom: 12,
    lineHeight: 20,
  },
  busAvailLoader: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  viewRouteBtn: {
    alignSelf: "stretch",
    backgroundColor: colors.accentBlue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 2,
  },
  viewRouteBtnTxt: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  bottomBanner: {
    marginHorizontal: 16,
    marginTop: 22,
    borderRadius: 16,
    padding: 17,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  bottomBannerText: {
    color: colors.white,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
  },
});
