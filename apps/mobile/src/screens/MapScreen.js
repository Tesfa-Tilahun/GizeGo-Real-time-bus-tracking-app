import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Marker, Polyline } from "react-native-maps";
import { EthiopiaMapView } from "../components/EthiopiaMapView.js";
import { ADDIS_ABABA, formatCoords } from "../config/ethiopiaMap.js";
import { useNotifications } from "../context/RealtimeContext.js";
import { usePassengerTracking } from "../hooks/usePassengerTracking.js";
import { AppHeader } from "../components/AppHeader.js";
import { SideMenu } from "../components/SideMenu.js";
import { colors } from "../theme/colors.js";
import {
  fetchMapPois,
  fetchRecommendedRoute,
  searchRoutes,
  fetchRouteById,
  fetchRouteOptimize,
  fetchRoutePassengerInfo,
  listRouteSummaries,
} from "../api/gizegoApi.js";
import { useLocale } from "../context/LocaleContext.js";
import { useRoutePreferences } from "../context/RoutePreferencesContext.js";
import { useBusTracking } from "../hooks/useBusTracking.js";
import { StatusBar } from "expo-status-bar";
import { JourneySearchSheet } from "../components/JourneySearchSheet.js";
import { RouteTripPanel } from "../components/RouteTripPanel.js";
import { TripRoutePolylines } from "../components/TripRoutePolylines.js";
import { RoutePathsLayer } from "../components/RoutePathsLayer.js";
import { RouteStopMarker } from "../components/RouteStopMarker.js";
import { BusMapMarker } from "../components/BusMapMarker.js";
import { RouteAlternativesBar } from "../components/RouteAlternativesBar.js";
import { useCurrentPlace } from "../hooks/useCurrentPlace.js";
import { decodePolyline } from "../utils/routePolyline.js";
import {
  estimateMinutesFromDistanceMeters,
  formatDurationHm,
  formatKmOneDecimal,
  minutesBetweenHHmm,
} from "../utils/travelMetrics.js";
import { resolveTripEndpoints } from "../utils/tripSearch.js";
import { pickStopEtaForUser } from "../utils/stopEtaForUser.js";
import {
  lineBusToUser,
  nearestLiveBus,
  resolveTripSegment,
  buildOptimizeParams,
  pathFromRouteStartToBus,
} from "../utils/mapJourneyVisuals.js";
import { filterRoutesByQuery } from "../utils/routeDisplay.js";

const BUS_TO_USER_COLOR = "#00838f";


const CATEGORY_COLOR = {
  restaurant: "#e6b422",
  bar: "#3d7ea6",
  shopping: "#9b59b6",
};

function markerColor(category) {
  return CATEGORY_COLOR[category] || colors.accentBlue;
}

function busPinColor(status) {
  if (status === "delayed") return "#f57c00";
  if (status === "stopped") return "#757575";
  return "#1a73e8";
}

/** Prefer encoded road path; otherwise connect ordered stops. */
function coordsFromRoute(route) {
  if (!route) return [];
  const p = route.polyline;
  if (typeof p === "string" && p.trim().length > 0) {
    const decoded = decodePolyline(p);
    if (decoded.length > 1) return decoded;
  }
  const stops = route.stops;
  if (Array.isArray(stops) && stops.length > 1) {
    const ordered = [...stops].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    return ordered.map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
  }
  return [];
}

/** Data for the Google-style bottom sheet (km, ETA, schedule, fare). */
function buildTripCardModel(route, buses, summary) {
  if (!route && !summary) return null;
  const name = route?.name ?? summary?.name ?? "";
  const dm = route?.distanceMeters ?? summary?.distanceMeters ?? null;
  const kmStr = formatKmOneDecimal(dm);
  const etaMin = estimateMinutesFromDistanceMeters(dm);
  const bus = buses?.[0];
  let scheduleLine;
  if (bus?.departureTime && bus?.arrivalTime) {
    const span = minutesBetweenHHmm(bus.departureTime, bus.arrivalTime);
    const dur = span != null ? formatDurationHm(span) : "";
    scheduleLine =
      dur.length > 0
        ? `${bus.departureTime} → ${bus.arrivalTime} · ${dur}`
        : `${bus.departureTime} → ${bus.arrivalTime}`;
  }
  const price = route?.price ?? summary?.price;
  const busCount = buses?.length ?? 0;
  return {
    title: name || "—",
    kmStr,
    etaMin,
    scheduleLine,
    price,
    busCount,
  };
}

function altPathKey(alt, index) {
  return alt.routeId ?? alt.name ?? `alt-${index}`;
}

function pathKeyFromSelection(sel, alts, hasLongest) {
  if (sel.type === "primary") return "primary";
  if (sel.type === "longest") return hasLongest ? "longest" : "primary";
  if (sel.type === "alt" && sel.altIndex >= 0 && sel.altIndex < alts.length) {
    return altPathKey(alts[sel.altIndex], sel.altIndex);
  }
  return "primary";
}

function selectionFromPathKey(pathKey, alts, hasLongest) {
  if (pathKey === "primary") return { type: "primary", altIndex: 0 };
  if (pathKey === "longest" && hasLongest) return { type: "longest", altIndex: 0 };
  const idx = alts.findIndex((a, i) => altPathKey(a, i) === pathKey);
  if (idx >= 0) return { type: "alt", altIndex: idx };
  return { type: "primary", altIndex: 0 };
}

export function MapScreen({ navigation, route }) {
  const { t } = useLocale();
  const { recordRecentTrip, toggleFavorite, isFavorite } = useRoutePreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [journeyOpen, setJourneyOpen] = useState(false);
  const [tripFromLabel, setTripFromLabel] = useState("");
  const [tripToLabel, setTripToLabel] = useState("");
  const currentPlace = useCurrentPlace(true);
  const [banner, setBanner] = useState("");
  const [pois, setPois] = useState([]);
  const [routeCoords, setRouteCoords] = useState([]);
  const [loading, setLoading] = useState(true);
  /** Routes that match departure/arrival search (for user to pick one). */
  const [matchingRoutes, setMatchingRoutes] = useState([]);
  /** Fallback catalog routes when trip search returns no direct match. */
  const [suggestedRoutesForTrip, setSuggestedRoutesForTrip] = useState([]);
  const [tripNoMatch, setTripNoMatch] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  /** Bottom card: distance, time, schedule (Google Maps–style). */
  const [tripCard, setTripCard] = useState(null);
  const [routeStops, setRouteStops] = useState([]);
  const [optimizedCoords, setOptimizedCoords] = useState([]);
  const [alternativePaths, setAlternativePaths] = useState([]);
  const [longestPath, setLongestPath] = useState(null);
  const [primaryPathMinutes, setPrimaryPathMinutes] = useState(null);
  const [primaryPathDistanceMeters, setPrimaryPathDistanceMeters] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [stopEtas, setStopEtas] = useState([]);
  const [passengerInfo, setPassengerInfo] = useState(null);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [selectedPathKey, setSelectedPathKey] = useState("primary");
  const [tripDetailsExpanded, setTripDetailsExpanded] = useState(false);
  const [watchLive, setWatchLive] = useState(false);

  const mapRef = useRef(null);
  const userPathFocusRef = useRef(false);
  /** Persists user's path chip choice across optimize refreshes (type + alt index). */
  const userPathSelectionRef = useRef({ type: "primary", altIndex: 0 });
  const prevSelectedRouteRef = useRef(null);
  const trackingRouteId = selectedRouteId;
  const { buses: liveBuses, connected: trackingConnected, traffic } = useBusTracking(trackingRouteId);
  const { watchRoute } = useNotifications();
  const passenger = usePassengerTracking(true);
  const {
    coords: userCoords,
    placeName: userPlaceName,
    nearbyBuses: socketNearbyBuses,
    followUser,
    setFollowUser,
    mapRegion: userMapRegion,
    error: locationError,
    inEthiopia,
  } = passenger;

  const isTripSearch = Boolean(route.params?.arrival?.trim?.() || tripToLabel);
  /** When viewing a searched or selected route, focus the map on the route—not the user's GPS. */
  const routeFocusMode = Boolean(selectedRouteId || isTripSearch);

  const displayBuses = useMemo(() => {
    const raw = selectedRouteId
      ? liveBuses
      : liveBuses.length > 0
        ? liveBuses
        : socketNearbyBuses;
    const seen = new Set();
    return raw.filter((bus) => {
      if (!bus?.busId) return false;
      const key = `${bus.routeId ?? selectedRouteId ?? ""}:${bus.busId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [liveBuses, socketNearbyBuses, selectedRouteId]);

  const tripVisual = useMemo(
    () => resolveTripSegment(routeStops, tripFromLabel, tripToLabel, userCoords),
    [routeStops, tripFromLabel, tripToLabel, userCoords],
  );

  const visibleStops = useMemo(() => {
    if (!routeStops.length) return [];
    if (!isTripSearch || tripVisual.depIdx >= tripVisual.arrIdx) return routeStops;
    return routeStops.slice(tripVisual.depIdx, tripVisual.arrIdx + 1);
  }, [routeStops, isTripSearch, tripVisual.depIdx, tripVisual.arrIdx]);

  /** Full road-following path when available; trip segment when searching A→B. */
  const displayRouteLine = useMemo(() => {
    if (isTripSearch && tripVisual.segment.length > 1) {
      return tripVisual.segment;
    }
    if (optimizedCoords.length > 1) return optimizedCoords;
    return routeCoords;
  }, [isTripSearch, tripVisual.segment, optimizedCoords, routeCoords]);

  const mainRouteLine = displayRouteLine;

  const applyOptimizeResult = useCallback((opt, { resetSelection = false } = {}) => {
    if (opt?.primary?.coordinates?.length > 1) {
      setOptimizedCoords(opt.primary.coordinates);
      setPrimaryPathMinutes(opt.primary.durationMinutes ?? null);
      setPrimaryPathDistanceMeters(opt.primary.distanceMeters ?? null);
    } else {
      setOptimizedCoords([]);
      setPrimaryPathMinutes(null);
      setPrimaryPathDistanceMeters(null);
    }
    const alts = (opt?.alternatives ?? []).filter((a) => a.coordinates?.length > 1);
    setAlternativePaths(alts);
    setAlternatives(alts);
    setLongestPath(opt?.longest?.coordinates?.length > 1 ? opt.longest : null);

    if (resetSelection) {
      userPathFocusRef.current = false;
      userPathSelectionRef.current = { type: "primary", altIndex: 0 };
      setSelectedPathKey("primary");
      return;
    }

    const hasLongest = opt?.longest?.coordinates?.length > 1;
    const resolved = pathKeyFromSelection(userPathSelectionRef.current, alts, hasLongest);
    userPathSelectionRef.current = selectionFromPathKey(resolved, alts, hasLongest);
    setSelectedPathKey(resolved);
  }, []);

  const optimizeTripKey = useMemo(() => {
    const p = buildOptimizeParams(tripVisual);
    return [
      p.fromStopId ?? "",
      p.toStopId ?? "",
      p.fromLat ?? "",
      p.fromLng ?? "",
      p.toLat ?? "",
      p.toLng ?? "",
    ].join("|");
  }, [
    tripVisual.departure?.id,
    tripVisual.arrival?.id,
    tripVisual.departure?.latitude,
    tripVisual.departure?.longitude,
    tripVisual.arrival?.latitude,
    tripVisual.arrival?.longitude,
  ]);

  const pathOptions = useMemo(() => {
    if (optimizedCoords.length < 2) return [];
    const opts = [
      {
        key: "primary",
        label: t("map.pathShortest"),
        minutes: primaryPathMinutes,
        km: formatKmOneDecimal(primaryPathDistanceMeters),
        isPrimary: true,
      },
    ];
    alternativePaths.forEach((alt, i) => {
      opts.push({
        key: altPathKey(alt, i),
        label: t("map.pathOption", { n: i + 2 }),
        minutes: alt.durationMinutes,
        km: formatKmOneDecimal(alt.distanceMeters),
        isPrimary: false,
      });
    });
    if (longestPath) {
      opts.push({
        key: "longest",
        label: t("map.pathLongest"),
        minutes: longestPath.durationMinutes,
        km: formatKmOneDecimal(longestPath.distanceMeters),
        isPrimary: false,
      });
    }
    return opts;
  }, [
    optimizedCoords.length,
    alternativePaths,
    longestPath,
    primaryPathMinutes,
    primaryPathDistanceMeters,
    t,
  ]);

  /** Selected path draws bold blue; others stay visible as colored alternatives. */
  const mapPathLayers = useMemo(() => {
    if (optimizedCoords.length < 2) {
      return {
        primary: mainRouteLine,
        alternatives: [],
        longestPath: null,
        primaryMinutes: null,
        primaryDistanceMeters: null,
      };
    }

    const shortestLayer = {
      routeId: "shortest-view",
      coordinates: optimizedCoords,
      durationMinutes: primaryPathMinutes,
      distanceMeters: primaryPathDistanceMeters,
    };

    if (selectedPathKey === "primary") {
      return {
        primary: optimizedCoords,
        alternatives: alternativePaths,
        longestPath,
        primaryMinutes: primaryPathMinutes,
        primaryDistanceMeters: primaryPathDistanceMeters,
      };
    }

    let selectedCoords = optimizedCoords;
    let selectedMinutes = primaryPathMinutes;
    let selectedDistance = primaryPathDistanceMeters;
    const otherAlts = [shortestLayer];

    if (selectedPathKey === "longest" && longestPath?.coordinates?.length > 1) {
      selectedCoords = longestPath.coordinates;
      selectedMinutes = longestPath.durationMinutes;
      selectedDistance = longestPath.distanceMeters;
      alternativePaths.forEach((a, i) => {
        otherAlts.push({ ...a, routeId: altPathKey(a, i) });
      });
      return {
        primary: selectedCoords,
        alternatives: otherAlts,
        longestPath: null,
        primaryMinutes: selectedMinutes,
        primaryDistanceMeters: selectedDistance,
      };
    }

    if (longestPath?.coordinates?.length > 1) {
      otherAlts.push({ ...longestPath, routeId: longestPath.routeId ?? "longest-view" });
    }

    const idx = alternativePaths.findIndex((a, i) => altPathKey(a, i) === selectedPathKey);
    if (idx >= 0) {
      selectedCoords = alternativePaths[idx].coordinates;
      selectedMinutes = alternativePaths[idx].durationMinutes;
      selectedDistance = alternativePaths[idx].distanceMeters;
      alternativePaths.forEach((a, i) => {
        if (i !== idx) otherAlts.push({ ...a, routeId: altPathKey(a, i) });
      });
    }

    return {
      primary: selectedCoords,
      alternatives: otherAlts.filter((a) => a.coordinates?.length > 1),
      longestPath: null,
      primaryMinutes: selectedMinutes,
      primaryDistanceMeters: selectedDistance,
    };
  }, [
    optimizedCoords,
    alternativePaths,
    longestPath,
    mainRouteLine,
    primaryPathMinutes,
    primaryPathDistanceMeters,
    selectedPathKey,
  ]);

  const nearestBus = useMemo(
    () => nearestLiveBus(displayBuses, userCoords),
    [displayBuses, userCoords],
  );

  const selectedBus = displayBuses.find((b) => b.busId === selectedBusId) ?? nearestBus ?? null;
  const trackedBus =
    displayBuses.find((b) => b.busId === selectedBusId) ?? displayBuses[0] ?? null;
  const busToUserLine = lineBusToUser(nearestBus, userCoords);

  const activeRoutePath =
    mapPathLayers.primary.length > 1 ? mapPathLayers.primary : mainRouteLine;

  const busTraveledPath = useMemo(() => {
    if (!trackedBus || activeRoutePath.length < 2) return [];
    return pathFromRouteStartToBus(activeRoutePath, trackedBus.progress);
  }, [trackedBus?.progress, trackedBus?.busId, activeRoutePath]);

  const nextStop = useMemo(() => {
    if (!trackedBus || visibleStops.length < 2) return null;
    const idx = Math.floor((trackedBus.progress ?? 0) * (visibleStops.length - 1));
    return visibleStops[Math.min(idx + 1, visibleStops.length - 1)] ?? null;
  }, [trackedBus?.progress, visibleStops]);

  useEffect(() => {
    if (displayBuses.length === 0) return;
    if (routeFocusMode) {
      setSelectedBusId((prev) => {
        if (prev && displayBuses.some((b) => b.busId === prev)) return prev;
        return displayBuses[0]?.busId ?? null;
      });
      return;
    }
    if (nearestBus?.busId) setSelectedBusId(nearestBus.busId);
  }, [nearestBus?.busId, displayBuses, routeFocusMode]);

  useEffect(() => {
    setFollowUser(false);
    if (selectedRouteId && selectedRouteId !== prevSelectedRouteRef.current) {
      setWatchLive(true);
      prevSelectedRouteRef.current = selectedRouteId;
    }
    if (!selectedRouteId) prevSelectedRouteRef.current = null;
  }, [selectedRouteId, setFollowUser]);

  useEffect(() => {
    if (!watchLive || !mapRef.current || !trackedBus) return;
    if (!Number.isFinite(trackedBus.latitude) || !Number.isFinite(trackedBus.longitude)) return;
    mapRef.current.animateToRegion(
      {
        latitude: trackedBus.latitude,
        longitude: trackedBus.longitude,
        latitudeDelta: 0.018,
        longitudeDelta: 0.018,
      },
      350,
    );
  }, [watchLive, trackedBus?.latitude, trackedBus?.longitude, trackedBus?.busId]);

  const applyRouteSummary = useCallback(
    async (summary) => {
      const fullRouteData = await fetchRouteById(summary.id);
      const rr = fullRouteData.route;
      setRouteCoords(coordsFromRoute(rr));
      setRouteStops(rr?.stops ?? []);
      setTripCard(buildTripCardModel(rr, fullRouteData.buses, summary));
      const busCount = fullRouteData.buses?.length ?? 0;
      setBanner(
        t("map.routeLine", {
          name: summary.name || rr?.name || "—",
          price: rr?.price ?? summary.price ?? "—",
          count: busCount,
        }),
      );
    },
    [t],
  );

  const loadRouteById = useCallback(
    async (routeIdParam) => {
      setLoading(true);
      setFollowUser(false);
      setMatchingRoutes([]);
      setSuggestedRoutesForTrip([]);
      setTripNoMatch(null);
      setSelectedRouteId(routeIdParam);
      try {
        const fullRouteData = await fetchRouteById(routeIdParam);
        const rr = fullRouteData.route;
        setRouteCoords(coordsFromRoute(rr));
        setRouteStops(rr?.stops ?? []);
        setTripCard(
          buildTripCardModel(rr, fullRouteData.buses, {
            id: routeIdParam,
            name: rr?.name,
            price: rr?.price,
            distanceMeters: rr?.distanceMeters,
          }),
        );
        const busCount = fullRouteData.buses?.length ?? 0;
        setBanner(
          t("map.routeLine", {
            name: rr?.name || "—",
            price: rr?.price ?? "—",
            count: busCount,
          }),
        );
      } catch {
        setRouteCoords([]);
        setRouteStops([]);
        setTripCard(null);
        setBanner(t("map.loadError"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const q = search.trim();

      const poiRes = await fetchMapPois(q);
      setPois(poiRes.pois ?? []);

      const routeIdParam = route.params?.routeId;
      const arrParam = route.params?.arrival?.trim?.() ?? "";

      if (routeIdParam && !arrParam) {
        return;
      }

      if (arrParam) {
        const paramCoords =
          route.params?.fromLat != null &&
          route.params?.fromLng != null &&
          Number.isFinite(Number(route.params.fromLat)) &&
          Number.isFinite(Number(route.params.fromLng))
            ? {
                latitude: Number(route.params.fromLat),
                longitude: Number(route.params.fromLng),
              }
            : null;

        const isUsingCurrentLocation =
          route.params?.fromUseCurrent != null
            ? Boolean(route.params.fromUseCurrent)
            : !route.params?.departure?.trim();
        const resolved = await resolveTripEndpoints({
          departure: route.params?.departure ?? "",
          arrival: arrParam,
          coords: isUsingCurrentLocation ? (paramCoords ?? userCoords) : null,
          placeName: isUsingCurrentLocation ? userPlaceName : "",
        });
        if (resolved.error) {
          setMatchingRoutes([]);
          setSuggestedRoutesForTrip([]);
          setTripNoMatch(null);
          setSelectedRouteId(null);
          setRouteCoords([]);
          setTripCard(null);
          setBanner(t("map.tripNeedDeparture"));
          return;
        }

        const fromLat =
          route.params?.fromLat != null && Number.isFinite(Number(route.params.fromLat))
            ? Number(route.params.fromLat)
            : resolved.fromLat;
        const fromLng =
          route.params?.fromLng != null && Number.isFinite(Number(route.params.fromLng))
            ? Number(route.params.fromLng)
            : resolved.fromLng;

        const depLabel = resolved.from || t("home.currentLocation");
        const searchRes = await searchRoutes(resolved.from, resolved.to, { fromLat, fromLng });
        const list = searchRes.routes ?? [];
        const canonicalFrom = searchRes.searchMeta?.from?.canonicalName;
        const canonicalTo = searchRes.searchMeta?.to?.canonicalName;
        const displayFrom = canonicalFrom || depLabel;
        const displayTo = canonicalTo || resolved.to;
        const problemMessage = searchRes.searchMeta?.message ?? null;
        setMatchingRoutes(list);
        setSuggestedRoutesForTrip([]);
        setTripNoMatch(null);
        setTripFromLabel(displayFrom);
        setTripToLabel(displayTo);

        if (list.length === 0) {
          setSelectedRouteId(null);
          setRouteCoords([]);
          setTripCard(null);
          setTripNoMatch({ from: displayFrom, to: displayTo, message: problemMessage });
          try {
            const catalog = await listRouteSummaries();
            const all = catalog.routes ?? [];
            let fallbacks = filterRoutesByQuery(all, resolved.to);
            if (fallbacks.length === 0) fallbacks = all;
            setSuggestedRoutesForTrip(fallbacks.slice(0, 8));
          } catch {
            setSuggestedRoutesForTrip([]);
          }
          setBanner("");
          return;
        }

        const first = list[0];
        setFollowUser(false);
        setSelectedRouteId(first.id);
        await applyRouteSummary(first);
        setBanner(t("map.tripSearchBanner", { from: displayFrom, to: displayTo }));
        void recordRecentTrip({
          fromLabel: displayFrom,
          toLabel: displayTo,
          fromUseCurrent: isUsingCurrentLocation,
          fromLat,
          fromLng,
          routeId: first.id,
          routeName: first.name,
        });
        return;
      }

      setMatchingRoutes([]);
      setSuggestedRoutesForTrip([]);
      setTripNoMatch(null);
      setSelectedRouteId(null);
      const recRes = await fetchRecommendedRoute();
      if (!recRes.route) {
        setTripCard(null);
        setBanner(t("map.followDbHint"));
      } else {
        setBanner(recRes.message || t("map.followDefault"));
        const rr = recRes.route;
        setSelectedRouteId(rr.id);
        setRouteCoords(coordsFromRoute(rr));
        setTripCard(buildTripCardModel(rr, [], { name: rr.name, distanceMeters: rr.distanceMeters, price: rr.price }));
      }
    } catch (_e) {
      setPois([]);
      setRouteCoords([]);
      setMatchingRoutes([]);
      setSuggestedRoutesForTrip([]);
      setTripNoMatch(null);
      setSelectedRouteId(null);
      setTripCard(null);
      setBanner(t("map.loadError"));
    } finally {
      setLoading(false);
    }
  }, [
    applyRouteSummary,
    route.params?.arrival,
    route.params?.departure,
    route.params?.fromUseCurrent,
    route.params?.fromLat,
    route.params?.fromLng,
    route.params?.routeId,
    search,
    t,
    userCoords?.latitude,
    userCoords?.longitude,
    userPlaceName,
    recordRecentTrip,
  ]);

  useEffect(() => {
    const id = route.params?.routeId;
    const arr = route.params?.arrival?.trim?.() ?? "";
    if (!id || arr) return;
    void loadRouteById(id);
  }, [route.params?.routeId, route.params?.arrival, loadRouteById]);

  useEffect(() => {
    const arr = route.params?.arrival?.trim?.() ?? "";
    if (route.params?.routeId && !arr) return undefined;
    const tmr = setTimeout(() => {
      void loadData();
    }, 350);
    return () => clearTimeout(tmr);
  }, [loadData, route.params?.routeId, route.params?.arrival]);

  useEffect(() => {
    if (!selectedRouteId) {
      watchRoute(null);
      return;
    }

    const stopPick = pickStopEtaForUser(stopEtas, userCoords);
    const liveBus = passengerInfo?.buses?.find((b) => b.availableNow) ?? nearestBus;
    const etaMinutes =
      stopPick.etaMinutes ??
      liveBus?.etaMinutes ??
      passengerInfo?.buses?.find((b) => b.etaMinutes != null)?.etaMinutes ??
      null;

    watchRoute(selectedRouteId, {
      etaMinutes,
      stopName: stopPick.stopName,
      busName: liveBus?.name ?? liveBus?.busName ?? "Bus",
    });
  }, [selectedRouteId, watchRoute, stopEtas, userCoords, nearestBus, passengerInfo]);

  useEffect(() => {
    setTripDetailsExpanded(false);
    userPathFocusRef.current = false;
    userPathSelectionRef.current = { type: "primary", altIndex: 0 };
    setSelectedPathKey("primary");
    setLongestPath(null);
    setAlternativePaths([]);
    setOptimizedCoords([]);
    setPrimaryPathMinutes(null);
    setPrimaryPathDistanceMeters(null);
  }, [route.params?.departure, route.params?.arrival, route.params?.fromLat, route.params?.fromLng]);

  useEffect(() => {
    setTripDetailsExpanded(false);
    userPathFocusRef.current = false;
    userPathSelectionRef.current = { type: "primary", altIndex: 0 };
    setSelectedPathKey("primary");
  }, [selectedRouteId]);

  useEffect(() => {
    if (!mapRef.current || !selectedRouteId) return;
    if (watchLive && trackedBus) return;
    if (userPathFocusRef.current || selectedPathKey !== "primary") return;
    const coords = mapPathLayers.primary.length > 1 ? mapPathLayers.primary : routeCoords;
    const fitCoords = [...coords];
    mapPathLayers.alternatives.forEach((a) => {
      if (a.coordinates?.length > 1) fitCoords.push(...a.coordinates);
    });
    if (mapPathLayers.longestPath?.coordinates?.length > 1) {
      fitCoords.push(...mapPathLayers.longestPath.coordinates);
    }
    displayBuses.forEach((b) => fitCoords.push({ latitude: b.latitude, longitude: b.longitude }));
    if (fitCoords.length < 2) return;
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(fitCoords, {
        edgePadding: { top: 120, right: 40, bottom: 240, left: 40 },
        animated: true,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [selectedRouteId, mapPathLayers.primary, mapPathLayers.alternatives, mapPathLayers.longestPath, routeCoords, displayBuses.length, watchLive, trackedBus?.busId, selectedPathKey]);

  useEffect(() => {
    if (!selectedRouteId) {
      setRouteStops([]);
      setOptimizedCoords([]);
      setAlternativePaths([]);
      setPrimaryPathMinutes(null);
      setAlternatives([]);
      setStopEtas([]);
      setPassengerInfo(null);
      return undefined;
    }
    let active = true;
    const loadExtras = async () => {
      try {
        const optParams = buildOptimizeParams(tripVisual);
        const [opt, pinfo, detail] = await Promise.all([
          fetchRouteOptimize(selectedRouteId, optParams),
          fetchRoutePassengerInfo(selectedRouteId),
          fetchRouteById(selectedRouteId),
        ]);
        if (!active) return;
        applyOptimizeResult(opt, { resetSelection: false });
        setPassengerInfo(pinfo);
        setStopEtas(pinfo?.stopEtas ?? []);
        setRouteStops(detail?.route?.stops ?? []);
      } catch {
        if (active) {
          setOptimizedCoords([]);
          setAlternativePaths([]);
          setPrimaryPathMinutes(null);
          setAlternatives([]);
          setStopEtas([]);
          setPassengerInfo(null);
        }
      }
    };
    void loadExtras();
    const iv = setInterval(() => void loadExtras(), 12_000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [selectedRouteId, applyOptimizeResult, optimizeTripKey]);

  useEffect(() => {
    if (watchLive || routeFocusMode) return;
    if (followUser && userCoords && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        },
        600,
      );
      return;
    }

    const fitCoords = [];
    if (mainRouteLine.length > 1) fitCoords.push(...mainRouteLine);
    alternativePaths.forEach((a) => {
      if (a.coordinates?.length > 1) fitCoords.push(...a.coordinates);
    });
    if (userCoords) fitCoords.push(userCoords);
    displayBuses.forEach((b) => fitCoords.push({ latitude: b.latitude, longitude: b.longitude }));
    if (fitCoords.length < 2 || !mapRef.current) return;
    const bottomPad = tripDetailsExpanded ? 260 : selectedRouteId ? 88 : 120;
    mapRef.current.fitToCoordinates(fitCoords, {
      edgePadding: { top: 80, right: 40, bottom: bottomPad, left: 40 },
      animated: true,
    });
  }, [
    mainRouteLine,
    followUser,
    watchLive,
    routeFocusMode,
    userCoords?.latitude,
    userCoords?.longitude,
    displayBuses.length,
    tripDetailsExpanded,
    selectedRouteId,
    alternativePaths.length,
  ]);

  useEffect(() => {
    if (route.params?.openJourneySearch) {
      setJourneyOpen(true);
      navigation.setParams({ openJourneySearch: undefined });
    }
  }, [route.params?.openJourneySearch, navigation]);

  useEffect(() => {
    if (route.params?.arrival) setTripToLabel(route.params.arrival);
    if (route.params?.departure?.trim?.()) {
      setTripFromLabel(route.params.departure);
    } else if (route.params?.arrival?.trim?.()) {
      setTripFromLabel(userPlaceName?.trim() || t("journey.currentLocation"));
    }
  }, [route.params?.departure, route.params?.arrival, userPlaceName, t]);

  const onPickMatchingRoute = async (summary) => {
    if (!summary?.id || summary.id === selectedRouteId) return;
    setFollowUser(false);
    setSelectedRouteId(summary.id);
    setLoading(true);
    try {
      await applyRouteSummary(summary);
      navigation.setParams({
        routeId: summary.id,
        arrival: route.params?.arrival,
        departure: route.params?.departure,
        fromLat: route.params?.fromLat,
        fromLng: route.params?.fromLng,
      });
      const arr = route.params?.arrival?.trim?.();
      if (arr) {
        const dep =
          route.params?.departure?.trim?.() ||
          userPlaceName?.trim() ||
          t("home.currentLocation");
        setBanner(t("map.tripSearchBanner", { from: dep, to: arr }));
      }
    } catch {
      setBanner(t("map.loadError"));
      setTripCard(null);
    } finally {
      setLoading(false);
    }
  };

  const startCoord = mainRouteLine[0] ?? routeCoords[0];
  const endCoord =
    mainRouteLine.length > 1
      ? mainRouteLine[mainRouteLine.length - 1]
      : routeCoords.length > 1
        ? routeCoords[routeCoords.length - 1]
        : null;
  const handlePathSelect = useCallback(
    (pathKey) => {
      userPathFocusRef.current = true;
      const hasLongest = longestPath?.coordinates?.length > 1;
      userPathSelectionRef.current = selectionFromPathKey(pathKey, alternativePaths, hasLongest);
      setSelectedPathKey(pathKey);
      if (!mapRef.current) return;
      let coords = optimizedCoords;
      if (pathKey === "longest" && longestPath?.coordinates?.length > 1) {
        coords = longestPath.coordinates;
      } else if (pathKey !== "primary") {
        const idx = alternativePaths.findIndex((a, i) => altPathKey(a, i) === pathKey);
        if (idx >= 0) coords = alternativePaths[idx].coordinates;
      }
      if (coords?.length > 1) {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 120, right: 40, bottom: 240, left: 40 },
          animated: true,
        });
      }
    },
    [optimizedCoords, alternativePaths, longestPath],
  );

  const handleJourneySearch = async ({
    departure,
    arrival,
    fromUseCurrent,
    fromLat,
    fromLng,
    fromLabel,
  }) => {
    const depLabel = fromUseCurrent ? fromLabel : departure || fromLabel;
    setLoading(true);
    setFollowUser(false);
    userPathFocusRef.current = false;
    userPathSelectionRef.current = { type: "primary", altIndex: 0 };
    setSelectedRouteId(null);
    setRouteCoords([]);
    setOptimizedCoords([]);
    setAlternativePaths([]);
    setMatchingRoutes([]);
    setSuggestedRoutesForTrip([]);
    setTripNoMatch(null);
    setTripFromLabel(depLabel);
    setTripToLabel(arrival);
    void recordRecentTrip({
      fromLabel: depLabel,
      toLabel: arrival,
      fromUseCurrent,
      fromLat,
      fromLng,
    });
    navigation.setParams({
      departure: fromUseCurrent ? "" : departure,
      arrival,
      fromUseCurrent,
      fromLat: fromUseCurrent ? fromLat : undefined,
      fromLng: fromUseCurrent ? fromLng : undefined,
      routeId: undefined,
      openJourneySearch: undefined,
    });
  };

  const mapDepartureLabel =
    tripFromLabel ||
    (currentPlace.placeName?.trim() ? currentPlace.placeName.trim() : t("journey.currentLocation"));

  const journeyBarSubtitle =
    tripToLabel
      ? `${mapDepartureLabel} → ${tripToLabel}`
      : t("journey.tapToPlan");

  const hasRoutePanel = Boolean(selectedRouteId && (passengerInfo || tripCard));
  const routePanelTitle = passengerInfo?.routeName || tripCard?.title || "";
  const routePanelPrice = passengerInfo?.price ?? tripCard?.price;
  const routeIsFavorite = selectedRouteId ? isFavorite(selectedRouteId) : false;

  const handleToggleFavorite = () => {
    if (!selectedRouteId) return;
    void toggleFavorite({
      id: selectedRouteId,
      name: routePanelTitle,
      code: passengerInfo?.routeCode ?? null,
      price: routePanelPrice,
      distanceMeters: primaryPathDistanceMeters ?? passengerInfo?.distanceMeters,
    });
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AppHeader onMenuPress={() => setMenuOpen(true)} search={search} onSearchChange={setSearch} />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} navigation={navigation} />

      {matchingRoutes.length > 1 ? (
        <View style={styles.pickerWrap}>
          <Text style={styles.pickerTitle}>{t("map.chooseRouteTitle")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {matchingRoutes.map((r) => {
              const active = selectedRouteId === r.id;
              const busLine =
                r.busCount != null ? ` · ${r.busCount} ${r.busCount === 1 ? "bus" : "buses"}` : "";
              const km = r.distanceMeters != null ? formatKmOneDecimal(r.distanceMeters) : null;
              const eta = r.distanceMeters != null ? estimateMinutesFromDistanceMeters(r.distanceMeters) : null;
              const distEta =
                km != null && eta != null
                  ? `\n${km} km · ~${eta} min`
                  : km != null
                    ? `\n${km} km`
                    : "";
              return (
                <Pressable
                  key={r.id}
                  style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                  onPress={() => void onPickMatchingRoute(r)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={4}>
                    {r.name}
                    {"\n"}
                    <Text style={styles.chipSub}>
                      {r.price != null ? `${r.price} ETB` : ""}
                      {r.stopCount != null ? ` · ${r.stopCount} stops` : ""}
                      {busLine}
                      {distEta}
                    </Text>
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {matchingRoutes.length === 0 && suggestedRoutesForTrip.length > 0 && isTripSearch ? (
        <View style={styles.pickerWrap}>
          <View style={styles.noDirectMatchBanner}>
            <Text style={styles.noDirectMatchTitle}>{t("map.noDirectMatchTitle")}</Text>
            {tripNoMatch ? (
              <Text style={styles.noDirectMatchTrip}>
                {t("home.noDirectMatchForTrip", {
                  from: tripNoMatch.from,
                  to: tripNoMatch.to,
                })}
              </Text>
            ) : null}
            <Text style={styles.noDirectMatchSub}>{t("map.noDirectMatchSub")}</Text>
            {tripNoMatch?.message ? (
              <Text style={styles.noDirectMatchSub}>{tripNoMatch.message}</Text>
            ) : null}
          </View>
          <Text style={styles.pickerTitle}>{t("map.suggestedRoutesTitle")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {suggestedRoutesForTrip.map((r) => {
              const active = selectedRouteId === r.id;
              const km = r.distanceMeters != null ? formatKmOneDecimal(r.distanceMeters) : null;
              const eta = r.distanceMeters != null ? estimateMinutesFromDistanceMeters(r.distanceMeters) : null;
              const distEta =
                km != null && eta != null
                  ? `\n${km} km · ~${eta} min`
                  : km != null
                    ? `\n${km} km`
                    : "";
              return (
                <Pressable
                  key={r.id}
                  style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
                  onPress={() => void onPickMatchingRoute(r)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={4}>
                    {r.name}
                    {"\n"}
                    <Text style={styles.chipSub}>
                      {r.price != null ? `${r.price} ETB` : ""}
                      {r.stopCount != null ? ` · ${r.stopCount} stops` : ""}
                      {distEta}
                    </Text>
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.mapWrap}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.accentBlue} />
          </View>
        ) : (
          <>
            <EthiopiaMapView
              mapRef={mapRef}
              initialRegion={ADDIS_ABABA}
              region={followUser && !routeFocusMode ? userMapRegion : undefined}
              followsUserLocation={followUser && !routeFocusMode}
              showsUserLocation={!routeFocusMode}
              showsMyLocationButton={!routeFocusMode}
            >
              {!routeFocusMode && userCoords ? (
                <Marker
                  coordinate={{
                    latitude: userCoords.latitude,
                    longitude: userCoords.longitude,
                  }}
                  title={t("map.youAreHere")}
                  description={userPlaceName || formatCoords(userCoords.latitude, userCoords.longitude)}
                  pinColor="#e91e63"
                />
              ) : null}
              {!isTripSearch
                ? pois.map((p) => (
                    <Marker
                      key={p.id}
                      coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                      title={p.name}
                      description={p.category}
                      pinColor={markerColor(p.category)}
                    />
                  ))
                : null}

              {optimizedCoords.length > 1 ? (
                <RoutePathsLayer
                  primaryCoords={mapPathLayers.primary}
                  primaryMinutes={mapPathLayers.primaryMinutes}
                  primaryDistanceMeters={mapPathLayers.primaryDistanceMeters}
                  longestPath={mapPathLayers.longestPath}
                  alternatives={mapPathLayers.alternatives}
                />
              ) : (
                <TripRoutePolylines coordinates={mainRouteLine} variant="primary" />
              )}

              {busTraveledPath.length > 1 ? (
                <Polyline
                  coordinates={busTraveledPath}
                  strokeColor="#2e7d32"
                  strokeWidth={6}
                  zIndex={8}
                />
              ) : null}

              {!routeFocusMode && busToUserLine.length > 1 ? (
                <Polyline
                  coordinates={busToUserLine}
                  strokeColor={BUS_TO_USER_COLOR}
                  strokeWidth={4}
                  lineDashPattern={[10, 6]}
                  zIndex={5}
                />
              ) : null}

              {isTripSearch && tripVisual.departure ? (
                <Marker
                  coordinate={{
                    latitude: tripVisual.departure.latitude,
                    longitude: tripVisual.departure.longitude,
                  }}
                  title={t("map.markerDeparture")}
                  description={tripVisual.departure.name}
                  pinColor="#1565c0"
                />
              ) : startCoord ? (
                <Marker coordinate={startCoord} title={t("map.markerStart")} pinColor="#0f9d58" />
              ) : null}

              {isTripSearch && tripVisual.arrival ? (
                <Marker
                  coordinate={{
                    latitude: tripVisual.arrival.latitude,
                    longitude: tripVisual.arrival.longitude,
                  }}
                  title={t("map.markerArrival")}
                  description={tripVisual.arrival.name}
                  pinColor="#c62828"
                />
              ) : endCoord && routeCoords.length > 1 ? (
                <Marker coordinate={endCoord} title={t("map.markerEnd")} pinColor="#db4437" />
              ) : null}

              {selectedRouteId && visibleStops.length > 0
                ? visibleStops.map((s) => (
                    <RouteStopMarker
                      key={s.id}
                      stop={s}
                      description={
                        stopEtas.find((e) => e.stopId === s.id)?.etaMinutes != null
                          ? t("map.stopEta", {
                              min: stopEtas.find((e) => e.stopId === s.id).etaMinutes,
                            })
                          : undefined
                      }
                    />
                  ))
                : null}

              {displayBuses.map((bus) => {
                const isTracked =
                  routeFocusMode
                    ? selectedBusId === bus.busId
                    : nearestBus?.busId === bus.busId;
                return (
                  <BusMapMarker
                    key={`${bus.busId}-${bus.routeId}`}
                    bus={bus}
                    isNearest={isTracked}
                    title={bus.busName}
                    description={
                      bus.status === "arrived" || bus.etaMinutes === 0
                        ? t("map.busArrived")
                        : !routeFocusMode && isTracked
                          ? t("map.busApproachingYou", {
                              min: bus.etaMinutes ?? "—",
                              status: t(`map.status.${bus.status ?? "moving"}`),
                            })
                          : t("map.busStatusDesc", {
                              status: t(`map.status.${bus.status ?? "moving"}`),
                              speed: bus.speedKmh ?? "—",
                              km:
                                bus.remainingMeters != null
                                  ? formatKmOneDecimal(bus.remainingMeters)
                                  : "—",
                              min: bus.etaMinutes ?? "—",
                            })
                    }
                    onPress={() => setSelectedBusId(bus.busId)}
                  />
                );
              })}
            </EthiopiaMapView>

            {selectedRouteId && pathOptions.length > 0 ? (
              <View style={styles.altRoutesBar} pointerEvents="box-none">
                <RouteAlternativesBar
                  options={pathOptions}
                  selectedKey={selectedPathKey}
                  onSelect={handlePathSelect}
                  t={t}
                />
              </View>
            ) : null}

            {selectedRouteId ? (
              <Pressable
                style={[styles.watchLiveBtn, watchLive && styles.watchLiveBtnActive]}
                onPress={() => setWatchLive((w) => !w)}
              >
                <Text style={[styles.watchLiveBtnTxt, watchLive && styles.watchLiveBtnTxtActive]}>
                  {watchLive ? t("map.watchingLive") : t("map.watchLive")}
                </Text>
              </Pressable>
            ) : null}

            {!hasRoutePanel ? (
              <Pressable style={styles.journeyBar} onPress={() => setJourneyOpen(true)}>
                <Text style={styles.journeyBarTitle}>{t("journey.title")}</Text>
                <Text style={styles.journeyBarSub} numberOfLines={1}>
                  {journeyBarSubtitle}
                </Text>
              </Pressable>
            ) : null}

            <JourneySearchSheet
              visible={journeyOpen}
              onClose={() => setJourneyOpen(false)}
              onSearch={handleJourneySearch}
              onSelectRoute={(r) => {
                setJourneyOpen(false);
                setTripFromLabel("");
                setTripToLabel("");
                userPathFocusRef.current = false;
                userPathSelectionRef.current = { type: "primary", altIndex: 0 };
                navigation.setParams({
                  routeId: r.id,
                  arrival: undefined,
                  departure: undefined,
                  fromLat: undefined,
                  fromLng: undefined,
                });
                void loadRouteById(r.id);
              }}
              currentPlace={currentPlace}
              initialDeparture={route.params?.departure ?? ""}
              initialArrival={route.params?.arrival ?? ""}
              initialFromCurrent={!route.params?.departure?.trim?.()}
            />

            {hasRoutePanel ? (
              <View
                style={[
                  styles.tripOverlay,
                  tripDetailsExpanded ? styles.tripOverlayExpanded : styles.tripOverlayCollapsed,
                ]}
              >
                <Pressable
                  style={styles.tripCollapsedHeader}
                  onPress={() => setTripDetailsExpanded((v) => !v)}
                >
                  <View style={styles.tripCollapsedMain}>
                    {tripFromLabel && tripToLabel ? (
                      <Text style={styles.tripCollapsedTrip} numberOfLines={1}>
                        {tripFromLabel} → {tripToLabel}
                      </Text>
                    ) : null}
                    <Text style={styles.tripCollapsedTitle} numberOfLines={1}>
                      {routePanelTitle}
                    </Text>
                    <Text style={styles.tripCollapsedMeta} numberOfLines={1}>
                      {routePanelPrice != null ? `${routePanelPrice} ETB` : ""}
                      {primaryPathDistanceMeters != null
                        ? `${routePanelPrice != null ? " · " : ""}${t("map.fmtKm", {
                            km: formatKmOneDecimal(primaryPathDistanceMeters),
                          })}`
                        : ""}
                      {primaryPathMinutes != null
                        ? ` · ${t("map.fmtEta", { min: primaryPathMinutes })}`
                        : ""}
                      {displayBuses.length > 0
                        ? ` · ${t("map.liveBusCount", { count: displayBuses.length })}`
                        : ` · ${t("map.liveBusWaiting")}`}
                    </Text>
                    {trackedBus ? (
                      <Text style={styles.tripCollapsedProgress} numberOfLines={1}>
                        {trackedBus.status === "arrived" || trackedBus.etaMinutes === 0
                          ? t("map.busArrived")
                          : t("map.tripProgress", {
                              pct: trackedBus.progressPercent ?? 0,
                              km: formatKmOneDecimal(trackedBus.remainingMeters),
                              min: trackedBus.etaMinutes ?? "—",
                            })}
                        {nextStop ? ` · ${t("map.nextStop", { name: nextStop.name })}` : ""}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.tripHeaderActions}>
                    <Pressable
                      style={styles.favoriteBtn}
                      hitSlop={8}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleToggleFavorite();
                      }}
                    >
                      <Text
                        style={routeIsFavorite ? styles.favoriteStarActive : styles.favoriteStarIdle}
                      >
                        {routeIsFavorite ? "♥" : "♡"}
                      </Text>
                    </Pressable>
                    <Text style={styles.tripExpandLabel}>
                      {tripDetailsExpanded ? t("map.hideDetails") : t("map.showDetails")}
                    </Text>
                  </View>
                </Pressable>
                {tripDetailsExpanded ? (
                  <ScrollView
                    style={styles.tripCardScroll}
                    contentContainerStyle={styles.tripCard}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                  >
                    {passengerInfo ? (
                      <RouteTripPanel
                        info={passengerInfo}
                        tripFrom={tripFromLabel}
                        tripTo={tripToLabel}
                        liveBusCount={displayBuses.length}
                        trackedBus={trackedBus}
                        nextStop={nextStop}
                        pathMinutes={primaryPathMinutes}
                        pathKm={formatKmOneDecimal(primaryPathDistanceMeters)}
                        compact
                      />
                    ) : (
                      <>
                        <Text style={styles.tripTitle} numberOfLines={2}>
                          {tripCard?.title}
                        </Text>
                        <ActivityIndicator color={colors.accentBlue} style={{ marginVertical: 12 }} />
                      </>
                    )}
                    {selectedBus ? (
                      <Text style={styles.tripBusDetail}>
                        {t("map.selectedBus", {
                          name: selectedBus.busName,
                          status: t(`map.status.${selectedBus.status}`),
                          speed: selectedBus.speedKmh,
                        })}
                      </Text>
                    ) : null}
                    {alternatives.length > 0 ? (
                      <Text style={styles.tripAlt} numberOfLines={2}>
                        {t("map.altRoutes", {
                          names: alternatives.map((a) => a.name).join(", "),
                        })}
                      </Text>
                    ) : null}
                    <Pressable style={styles.planTripLink} onPress={() => setJourneyOpen(true)}>
                      <Text style={styles.planTripLinkText}>{t("journey.title")}</Text>
                    </Pressable>
                  </ScrollView>
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  banner: {
    backgroundColor: colors.bannerBg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 52,
    justifyContent: "center",
  },
  bannerText: {
    color: colors.white,
    fontWeight: "600",
    textAlign: "center",
    fontSize: 15,
  },
  bannerLive: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
  },
  bannerLegend: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 4,
    fontStyle: "italic",
  },
  pickerWrap: {
    backgroundColor: colors.white,
    paddingVertical: 10,
    paddingLeft: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  noDirectMatchBanner: {
    marginRight: 12,
    marginBottom: 10,
    padding: 12,
    backgroundColor: "rgba(61, 126, 166, 0.05)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(61, 126, 166, 0.2)",
  },
  noDirectMatchTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.accentBlue,
    marginBottom: 4,
  },
  noDirectMatchTrip: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textDark,
    marginBottom: 4,
  },
  noDirectMatchSub: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  pickerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textDark,
    marginBottom: 8,
    marginLeft: 4,
  },
  chipsRow: {
    paddingRight: 12,
    alignItems: "stretch",
    flexDirection: "row",
  },
  chip: {
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: 220,
    minWidth: 120,
    marginRight: 8,
  },
  chipIdle: {
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: {
    borderColor: colors.accentBlue,
    backgroundColor: "rgba(61, 126, 166, 0.1)",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textDark,
  },
  chipTextActive: {
    color: colors.accentBlue,
  },
  chipSub: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textMuted,
  },
  mapWrap: {
    flex: 1,
    position: "relative",
  },
  altRoutesBar: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 8,
    zIndex: 20,
  },
  watchLiveBtn: {
    position: "absolute",
    right: 14,
    top: 14,
    backgroundColor: "#fff",
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1.5,
    borderColor: colors.accentBlue,
  },
  watchLiveBtnActive: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  watchLiveBtnTxt: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.accentBlue,
  },
  watchLiveBtnTxtActive: {
    color: "#fff",
  },
  journeyBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: Platform.OS === "ios" ? 100 : 88,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
  },
  journeyBarTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.textDark,
    marginBottom: 4,
  },
  journeyBarSub: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: "500",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tripOverlay: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: Platform.OS === "ios" ? 48 : 72,
    alignItems: "stretch",
  },
  tripOverlayCollapsed: {
    maxHeight: 72,
  },
  tripOverlayExpanded: {
    maxHeight: "75%",
    flex: 1,
  },
  tripCollapsedHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
  },
  tripCollapsedMain: {
    flex: 1,
    marginRight: 10,
  },
  tripCollapsedTrip: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accentBlue,
    marginBottom: 2,
  },
  tripCollapsedTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.textDark,
    marginBottom: 2,
  },
  tripCollapsedMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  tripCollapsedProgress: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1565c0",
    marginTop: 3,
  },
  tripExpandLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.accentBlue,
  },
  tripHeaderActions: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  favoriteBtn: {
    padding: 4,
  },
  favoriteStarActive: {
    fontSize: 22,
    color: "#e53935",
  },
  favoriteStarIdle: {
    fontSize: 22,
    color: "#bdbdbd",
  },
  planTripLink: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
  },
  planTripLinkText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.accentBlue,
  },
  tripCardScroll: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
    flexShrink: 1,
  },
  tripCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tripTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.textDark,
    marginBottom: 8,
  },
  tripPrimary: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  tripSchedule: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a73e8",
    marginTop: 4,
  },
  tripMeta: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textMuted,
    marginTop: 6,
  },
  tripLive: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.accentBlue,
    marginTop: 8,
  },
  tripBusDetail: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accentBlue,
    marginTop: 6,
  },
  tripAlt: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
    marginTop: 6,
  },
  stopEtaList: {
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ddd",
    paddingTop: 8,
  },
  stopEtaTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  stopEtaRow: {
    fontSize: 13,
    color: colors.textDark,
    marginBottom: 2,
  },
});
