import Fuse from "fuse.js";
import { LOCATION_ALIASES } from "../data/locationAliases.js";
import { canonicalPlaceName, normalizeSearchText } from "../shared/utils/searchText.js";
import { nominatimGeocoding } from "./NominatimGeocodingService.js";

const DEFAULT_NEAREST_RADIUS_METERS = Number(process.env.LOCATION_MATCH_RADIUS_METERS ?? 2000);
const GPS_SNAP_RADIUS_METERS = Number(process.env.GPS_SNAP_RADIUS_METERS ?? 2500);

function distanceMeters(a, b) {
  const R = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function toSearchRows(location) {
  const names = new Set([location.canonicalName, ...(location.aliases ?? [])]);
  return [...names].map((name) => ({
    id: location.id,
    name,
    normalized: normalizeSearchText(name),
    location,
  }));
}

const MAX_FUZZY_SCORE = 0.42;
const MAX_REVERSE_GEOCODE_FUZZY_SCORE = 0.58;

const GENERIC_REVERSE_PARTS = new Set([
  "addis ababa",
  "addis ababa city",
  "ethiopia",
  "city",
  "sub city",
  "woreda",
  "kebele",
  "region",
  "zone",
  "district",
  "street",
  "road",
  "avenue",
  "area",
]);

export class LocationAliasResolver {
  constructor(routeRepository) {
    this.routeRepository = routeRepository;
    this.cache = null;
    this.cacheUntil = 0;
  }

  async getLocations() {
    const now = Date.now();
    if (this.cache && now < this.cacheUntil) return this.cache;

    const stopLocations = await this.routeRepository.listCanonicalStopLocations();
    const byName = new Map();
    for (const loc of [...stopLocations, ...LOCATION_ALIASES]) {
      const key = normalizeSearchText(loc.canonicalName);
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, {
          ...loc,
          aliases: [...new Set([loc.canonicalName, ...(loc.aliases ?? [])])],
        });
        continue;
      }
      existing.aliases = [...new Set([...existing.aliases, loc.canonicalName, ...(loc.aliases ?? [])])];
      if (Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
        existing.latitude = loc.latitude;
        existing.longitude = loc.longitude;
      }
    }

    const locations = [...byName.values()];
    const rows = locations.flatMap(toSearchRows);
    const fuse = new Fuse(rows, {
      keys: ["name", "normalized"],
      includeScore: true,
      threshold: 0.34,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });

    this.cache = { locations, rows, fuse };
    this.cacheUntil = now + 60_000;
    return this.cache;
  }

  async resolveText(query, opts = {}) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return null;
    const maxScore = Number.isFinite(opts.maxScore) ? opts.maxScore : MAX_FUZZY_SCORE;

    const { rows, fuse } = await this.getLocations();
    const exact = fuse
      ? rows.find((row) => row.normalized === normalizedQuery || row.normalized.replace(/\s+/g, "") === normalizedQuery.replace(/\s+/g, ""))
      : null;
    if (exact) {
      return {
        ...exact.location,
        match: { type: "alias-exact", query, normalizedQuery, matchedAlias: exact.name, score: 0 },
      };
    }

    const best = fuse.search(normalizedQuery, { limit: 1 })[0];
    if (!best || (best.score ?? 1) > maxScore) return null;
    return {
      ...best.item.location,
      match: {
        type: "alias-fuzzy",
        query,
        normalizedQuery,
        matchedAlias: best.item.name,
        score: best.score ?? null,
      },
    };
  }

  collectReverseGeocodeCandidates(reverse) {
    const seen = new Set();
    const candidates = [];
    const add = (value) => {
      const text = String(value ?? "").trim();
      const normalized = normalizeSearchText(text);
      if (!normalized || normalized.length < 2 || seen.has(normalized)) return;
      if (GENERIC_REVERSE_PARTS.has(normalized)) return;
      seen.add(normalized);
      candidates.push(text);
    };

    add(reverse?.shortName);
    add(reverse?.name);
    for (const part of String(reverse?.name ?? "").split(",")) {
      add(part);
    }
    for (const candidate of candidates) {
      add(canonicalPlaceName(candidate));
    }
    return candidates;
  }

  async resolveFromNearestStop(latitude, longitude, radiusMeters) {
    const stop = await this.routeRepository.findNearestStop(latitude, longitude, radiusMeters);
    if (!stop) return null;

    const fromStopName = await this.resolveText(stop.name, { maxScore: MAX_REVERSE_GEOCODE_FUZZY_SCORE });
    const canonicalName = fromStopName?.canonicalName ?? stop.name;
    return {
      ...(fromStopName ?? {
        id: `stop-${stop.id}`,
        canonicalName: stop.name,
        latitude: stop.latitude,
        longitude: stop.longitude,
        aliases: [stop.name],
      }),
      canonicalName,
      latitude: stop.latitude,
      longitude: stop.longitude,
      match: {
        type: "nearest-stop",
        query: `${latitude},${longitude}`,
        normalizedQuery: normalizeSearchText(canonicalName),
        matchedAlias: stop.name,
        distanceMeters: Math.round(stop.distanceMeters ?? 0),
        stopId: stop.id,
        routeId: stop.routeId ?? null,
      },
    };
  }

  async suggest(query, limit = 8) {
    const normalizedQuery = normalizeSearchText(query);
    const compactQuery = normalizedQuery.replace(/\s+/g, "");
    if (!normalizedQuery) return [];

    const { rows, fuse } = await this.getLocations();
    const byId = new Map();

    for (const row of rows) {
      const compactRow = row.normalized.replace(/\s+/g, "");
      if (
        row.normalized.startsWith(normalizedQuery) ||
        (normalizedQuery.length >= 3 && row.normalized.includes(normalizedQuery)) ||
        compactRow.startsWith(compactQuery) ||
        (compactQuery.length >= 3 && compactRow.includes(compactQuery))
      ) {
        byId.set(row.location.id, {
          ...row.location,
          match: {
            type: "alias-prefix",
            query,
            normalizedQuery,
            matchedAlias: row.name,
            score: 0,
          },
        });
      }
    }

    if (byId.size > 0) {
      return [...byId.values()].slice(0, limit).map((location) => publicLocation(location));
    }

    for (const result of fuse.search(normalizedQuery, { limit: limit * 2 })) {
      if ((result.score ?? 1) > MAX_FUZZY_SCORE) continue;
      if (byId.has(result.item.location.id)) continue;
      byId.set(result.item.location.id, {
        ...result.item.location,
        match: {
          type: "alias-fuzzy",
          query,
          normalizedQuery,
          matchedAlias: result.item.name,
          score: result.score ?? null,
        },
      });
      if (byId.size >= limit) break;
    }

    return [...byId.values()].slice(0, limit).map((location) => publicLocation(location));
  }

  async resolveCoordinates(latitude, longitude, radiusMeters = DEFAULT_NEAREST_RADIUS_METERS) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const origin = { latitude, longitude };
    const snapRadius = Math.max(radiusMeters, GPS_SNAP_RADIUS_METERS);
    let reverse = null;
    const reverseGeocodeName = () => reverse?.shortName || reverse?.name || null;

    const withGps = (location, matchType, extra = {}) => ({
      ...location,
      userGps: origin,
      match: {
        ...location.match,
        type: matchType,
        reverseGeocodeName: reverseGeocodeName(),
        ...extra,
      },
    });

    const nearestStop = await this.resolveFromNearestStop(latitude, longitude, snapRadius);
    if (nearestStop && (nearestStop.match?.distanceMeters ?? snapRadius) <= 800) {
      return withGps(nearestStop, "nearest-stop");
    }

    try {
      reverse = await nominatimGeocoding.reverseGeocode(latitude, longitude);
      for (const candidate of this.collectReverseGeocodeCandidates(reverse)) {
        const fromText = await this.resolveText(candidate, { maxScore: MAX_REVERSE_GEOCODE_FUZZY_SCORE });
        if (fromText) {
          return withGps(fromText, "reverse-geocode-alias", {
            matchedAlias: fromText.match?.matchedAlias ?? candidate,
          });
        }
      }
    } catch {
      reverse = null;
    }

    if (nearestStop) {
      return withGps(nearestStop, "nearest-stop");
    }

    const { locations } = await this.getLocations();
    let best = null;
    for (const loc of locations) {
      if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) continue;
      const distance = distanceMeters(origin, loc);
      if (!best || distance < best.distanceMeters) {
        best = { ...loc, distanceMeters: Math.round(distance) };
      }
    }
    if (!best || best.distanceMeters > snapRadius) return null;
    return withGps(best, "nearest-location", {
      query: `${latitude},${longitude}`,
      normalizedQuery: normalizeSearchText(best.canonicalName),
      matchedAlias: best.canonicalName,
      distanceMeters: best.distanceMeters,
    });
  }
}

function publicLocation(location) {
  return {
    id: location.id,
    canonicalName: location.canonicalName,
    latitude: location.latitude,
    longitude: location.longitude,
    aliases: location.aliases ?? [],
    matchedAlias: location.match?.matchedAlias ?? null,
    matchType: location.match?.type ?? null,
    score: location.match?.score ?? null,
    distanceMeters: location.match?.distanceMeters ?? null,
    reverseGeocodeName: location.match?.reverseGeocodeName ?? null,
  };
}
