import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  addRecentTrip,
  loadFavoriteRoutes,
  loadRecentTrips,
  toggleFavoriteRoute,
  isFavoriteRouteId,
} from "../storage/routePreferences.js";

const RoutePreferencesContext = createContext(null);

export function RoutePreferencesProvider({ children }) {
  const [recentTrips, setRecentTrips] = useState([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const [recent, favorites] = await Promise.all([loadRecentTrips(), loadFavoriteRoutes()]);
    setRecentTrips(recent);
    setFavoriteRoutes(favorites);
    setReady(true);
    return { recent, favorites };
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const recordRecentTrip = useCallback(async (trip) => {
    const next = await addRecentTrip(trip);
    setRecentTrips(next);
    return next;
  }, []);

  const toggleFavorite = useCallback(async (route) => {
    const { favorites, added } = await toggleFavoriteRoute(route);
    setFavoriteRoutes(favorites);
    return added;
  }, []);

  const isFavorite = useCallback(
    (routeId) => isFavoriteRouteId(favoriteRoutes, routeId),
    [favoriteRoutes],
  );

  const value = useMemo(
    () => ({
      ready,
      recentTrips,
      favoriteRoutes,
      refresh,
      recordRecentTrip,
      toggleFavorite,
      isFavorite,
    }),
    [ready, recentTrips, favoriteRoutes, refresh, recordRecentTrip, toggleFavorite, isFavorite],
  );

  return (
    <RoutePreferencesContext.Provider value={value}>{children}</RoutePreferencesContext.Provider>
  );
}

export function useRoutePreferences() {
  const ctx = useContext(RoutePreferencesContext);
  if (!ctx) throw new Error("useRoutePreferences must be inside RoutePreferencesProvider");
  return ctx;
}
